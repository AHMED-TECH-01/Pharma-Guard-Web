import { Router } from 'express';
import type {
  InventoryBatchListResponse,
  MedicineDetail,
  MedicineListResponse,
} from '@pharmaguard/types';
import {
  adjustStockSchema,
  createBatchSchema,
  createMedicineSchema,
  listInventoryBatchesQuerySchema,
  listMedicinesQuerySchema,
  updateBatchSchema,
  updateMedicineSchema,
} from '@pharmaguard/validation';
import {
  getValidatedBody,
  getValidatedQuery,
  validateBody,
  validateQuery,
} from '../../middleware/validate.js';
import { PERMISSIONS, requirePermission } from '../../middleware/authorize.js';
import { ApiError } from '../../utils/api-error.js';
import { writeAudit } from '../../utils/audit.js';
import { ok } from '../../utils/respond.js';
import {
  createMedicine,
  deleteMedicine,
  getMedicineDetail,
  listMedicines,
  setMedicineArchived,
  updateMedicine,
} from './medicine.service.js';
import {
  adjustBatchQuantity,
  createBatch,
  getBatch,
  listBatches,
  listInventoryBatches,
  updateBatch,
} from './batch.service.js';

/**
 * Inventory endpoints (TRD §7 Medicines/Batches, PRD §10.7).
 * Reads require inventory.read; writes require inventory.write. Hard
 * deletes mirror the RLS intent (0002_rls.sql) - OWNER/MANAGER only -
 * because the service client bypasses RLS.
 */
export const inventoryRouter = Router();

inventoryRouter.get(
  '/medicines',
  requirePermission(PERMISSIONS.inventoryRead),
  validateQuery(listMedicinesQuerySchema),
  async (req, res, next) => {
    try {
      const query = getValidatedQuery(req, listMedicinesQuerySchema);
      const response: MedicineListResponse = await listMedicines(req.pharmacyId!, query);
      ok(res, response);
    } catch (error) {
      next(error);
    }
  },
);

inventoryRouter.post(
  '/medicines',
  requirePermission(PERMISSIONS.inventoryWrite),
  validateBody(createMedicineSchema),
  async (req, res, next) => {
    try {
      if (!req.auth || !req.pharmacyId) {
        throw ApiError.unauthorized();
      }
      const input = getValidatedBody(req, createMedicineSchema);
      const medicine = await createMedicine(req.pharmacyId, req.auth.userId, input);
      await writeAudit({
        pharmacyId: req.pharmacyId,
        userId: req.auth.userId,
        action: input.confirmDuplicate
          ? 'medicine.created_confirmed_duplicate'
          : 'medicine.created',
        entityType: 'medicine',
        entityId: medicine.id,
        after: { name: medicine.name, strength: medicine.strength },
        request: req,
      });
      ok(res, { medicine }, 201);
    } catch (error) {
      next(error);
    }
  },
);

inventoryRouter.get(
  '/batches',
  requirePermission(PERMISSIONS.inventoryRead),
  validateQuery(listInventoryBatchesQuerySchema),
  async (req, res, next) => {
    try {
      const query = getValidatedQuery(req, listInventoryBatchesQuerySchema);
      const response: InventoryBatchListResponse = await listInventoryBatches(
        req.pharmacyId!,
        query,
      );
      ok(res, response);
    } catch (error) {
      next(error);
    }
  },
);

inventoryRouter.get(
  '/medicines/:id',
  requirePermission(PERMISSIONS.inventoryRead),
  async (req, res, next) => {
    try {
      const detail: MedicineDetail = await getMedicineDetail(req.pharmacyId!, String(req.params.id));
      ok(res, detail);
    } catch (error) {
      next(error);
    }
  },
);

inventoryRouter.patch(
  '/medicines/:id',
  requirePermission(PERMISSIONS.inventoryWrite),
  validateBody(updateMedicineSchema),
  async (req, res, next) => {
    try {
      if (!req.auth || !req.pharmacyId) {
        throw ApiError.unauthorized();
      }
      const medicineId = String(req.params.id);
      const input = getValidatedBody(req, updateMedicineSchema);
      const before = await getMedicineDetail(req.pharmacyId, medicineId);
      const medicine = await updateMedicine(req.pharmacyId, medicineId, input);
      await writeAudit({
        pharmacyId: req.pharmacyId,
        userId: req.auth.userId,
        action: 'medicine.updated',
        entityType: 'medicine',
        entityId: medicine.id,
        before: { name: before.medicine.name, reorderLevel: before.medicine.reorderLevel },
        after: { name: medicine.name, reorderLevel: medicine.reorderLevel },
        request: req,
      });
      ok(res, { medicine });
    } catch (error) {
      next(error);
    }
  },
);

inventoryRouter.delete(
  '/medicines/:id',
  requirePermission(PERMISSIONS.inventoryWrite),
  async (req, res, next) => {
    try {
      if (!req.auth || !req.pharmacyId) {
        throw ApiError.unauthorized();
      }
      const medicineId = String(req.params.id);
      const hard = req.query.mode === 'hard';
      if (hard && req.role !== 'OWNER' && req.role !== 'MANAGER') {
        throw ApiError.forbidden('Only the owner or a manager can permanently delete medicines');
      }

      if (hard) {
        await deleteMedicine(req.pharmacyId, medicineId);
        await writeAudit({
          pharmacyId: req.pharmacyId,
          userId: req.auth.userId,
          action: 'medicine.deleted',
          entityType: 'medicine',
          entityId: medicineId,
          request: req,
        });
        ok(res, { deleted: true });
        return;
      }

      // Default: archival (PRD "Delete/archival") - history stays intact.
      const medicine = await setMedicineArchived(req.pharmacyId, medicineId, true);
      await writeAudit({
        pharmacyId: req.pharmacyId,
        userId: req.auth.userId,
        action: 'medicine.archived',
        entityType: 'medicine',
        entityId: medicine.id,
        after: { isArchived: true },
        request: req,
      });
      ok(res, { medicine, archived: true });
    } catch (error) {
      next(error);
    }
  },
);

inventoryRouter.get(
  '/medicines/:id/batches',
  requirePermission(PERMISSIONS.inventoryRead),
  async (req, res, next) => {
    try {
      const batches = await listBatches(req.pharmacyId!, String(req.params.id));
      ok(res, { batches });
    } catch (error) {
      next(error);
    }
  },
);

inventoryRouter.post(
  '/medicines/:id/batches',
  requirePermission(PERMISSIONS.inventoryWrite),
  validateBody(createBatchSchema),
  async (req, res, next) => {
    try {
      if (!req.auth || !req.pharmacyId) {
        throw ApiError.unauthorized();
      }
      const batch = await createBatch(req.pharmacyId, String(req.params.id), getValidatedBody(req, createBatchSchema));
      await writeAudit({
        pharmacyId: req.pharmacyId,
        userId: req.auth.userId,
        action: 'batch.created',
        entityType: 'batch',
        entityId: batch.id,
        after: { batchNo: batch.batchNo, quantity: batch.quantity, expiryDate: batch.expiryDate },
        request: req,
      });
      ok(res, { batch }, 201);
    } catch (error) {
      next(error);
    }
  },
);

inventoryRouter.patch(
  '/batches/:id',
  requirePermission(PERMISSIONS.inventoryWrite),
  validateBody(updateBatchSchema),
  async (req, res, next) => {
    try {
      if (!req.auth || !req.pharmacyId) {
        throw ApiError.unauthorized();
      }
      const batchId = String(req.params.id);
      const before = await getBatch(req.pharmacyId, batchId);
      const batch = await updateBatch(req.pharmacyId, batchId, getValidatedBody(req, updateBatchSchema));
      await writeAudit({
        pharmacyId: req.pharmacyId,
        userId: req.auth.userId,
        action: 'batch.updated',
        entityType: 'batch',
        entityId: batch.id,
        before: { quantity: before.quantity, status: before.status, expiryDate: before.expiryDate },
        after: { quantity: batch.quantity, status: batch.status, expiryDate: batch.expiryDate },
        request: req,
      });
      ok(res, { batch });
    } catch (error) {
      next(error);
    }
  },
);

inventoryRouter.post(
  '/batches/:id/adjust',
  requirePermission(PERMISSIONS.inventoryWrite),
  validateBody(adjustStockSchema),
  async (req, res, next) => {
    try {
      if (!req.auth || !req.pharmacyId) {
        throw ApiError.unauthorized();
      }
      const batchId = String(req.params.id);
      const input = getValidatedBody(req, adjustStockSchema);
      const before = await getBatch(req.pharmacyId, batchId);
      const batch = await adjustBatchQuantity(req.pharmacyId, batchId, input);
      await writeAudit({
        pharmacyId: req.pharmacyId,
        userId: req.auth.userId,
        action: 'batch.stock_adjusted',
        entityType: 'batch',
        entityId: batch.id,
        before: { quantity: before.quantity },
        after: { quantity: batch.quantity, delta: input.delta, reason: input.reason },
        request: req,
      });
      ok(res, { batch });
    } catch (error) {
      next(error);
    }
  },
);
