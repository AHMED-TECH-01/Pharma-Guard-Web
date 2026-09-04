import type { Batch, Medicine } from './entities';

/**
 * Inventory wire contract (TRD §7 Medicines/Batches, PRD §10.7).
 * List rows carry a computed stock summary so the table renders without
 * extra round trips; detail responses embed the batch list (FEFO order).
 */

export type StockLevel = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface MedicineStockSummary {
  /** Total quantity across AVAILABLE batches. */
  quantity: number;
  level: StockLevel;
  /** Nearest expiry among AVAILABLE batches with quantity > 0 (ISO date). */
  nearestExpiry: string | null;
  expiredBatches: number;
  batchCount: number;
}

export type MedicineListItem = Medicine & { stock: MedicineStockSummary };

export interface MedicineListResponse {
  items: MedicineListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MedicineDetail {
  medicine: Medicine;
  batches: Batch[];
  stock: MedicineStockSummary;
}

/** Duplicate-candidate summary shown by DuplicateWarning (PRD §12). */
export interface PotentialDuplicate {
  id: string;
  name: string;
  strength: string | null;
  manufacturer: string | null;
  isArchived: boolean;
}

export type MedicineSortKey = 'name' | 'stock' | 'expiry' | 'updated';
export type MedicineStatusFilter =
  | 'all'
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'expired';

export interface MedicineListQuery {
  page: number;
  pageSize: number;
  search?: string;
  status: MedicineStatusFilter;
  category?: string;
  sort: MedicineSortKey;
  order: 'asc' | 'desc';
  includeArchived: boolean;
}

/**
 * Row-level status for the reference inventory table (ui-rules §7): one
 * badge per batch row, derived server-side. Priority: EXPIRED first, then
 * stock level, then the expiry buckets.
 */
export type InventoryBatchStatus =
  | 'EXPIRED'
  | 'OUT_OF_STOCK'
  | 'LOW_STOCK'
  | 'CRITICAL'
  | 'WARNING'
  | 'IN_STOCK';

export interface InventoryBatchItem {
  id: string;
  medicineId: string;
  medicineName: string;
  strength: string | null;
  batchNo: string;
  expiryDate: string;
  daysLeft: number;
  quantity: number;
  reorderLevel: number;
  status: InventoryBatchStatus;
}

export interface InventoryBatchListResponse {
  items: InventoryBatchItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type InventoryBatchSortKey = 'expiry' | 'medicine' | 'quantity';
export type InventoryBatchStatusFilter =
  | 'all'
  | 'expired'
  | 'critical'
  | 'warning'
  | 'low_stock'
  | 'out_of_stock'
  | 'in_stock';
