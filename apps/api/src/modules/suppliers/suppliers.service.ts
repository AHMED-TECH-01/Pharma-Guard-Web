import type {
  PurchaseListItem,
  SupplierDetail,
  SupplierListResponse,
} from '@pharmaguard/types';
import type { CreateSupplierInput, UpdateSupplierInput } from '@pharmaguard/validation';
import type { Request } from 'express';
import { getSupabaseAdmin } from '../../database/supabase.js';
import { ApiError } from '../../utils/api-error.js';
import { writeAudit } from '../../utils/audit.js';
import { listPurchases } from '../purchases/purchases.service.js';

/**
 * Suppliers service (PRD §10.13). Supplier endpoints extend TRD §7
 * (documented in the tracker) because the PRD requires list/add/edit plus
 * a detail view with medicines supplied, last order, and pending returns.
 */

interface SupplierRow {
  id: string;
  pharmacy_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_archived: boolean;
  created_at: string;
}

interface SupplierAggregate {
  medicinesSupplied: number;
  medicineNames: string[];
  lastOrderAt: string | null;
  pendingReturns: number;
}

const MEDICINE_NAMES_CAP = 6;

async function buildAggregate(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  pharmacyId: string,
  supplierIds: string[],
): Promise<Map<string, SupplierAggregate>> {
  const result = new Map<string, SupplierAggregate>();
  for (const id of supplierIds) {
    result.set(id, {
      medicinesSupplied: 0,
      medicineNames: [],
      lastOrderAt: null,
      pendingReturns: 0,
    });
  }
  if (supplierIds.length === 0) return result;

  const [purchasesResult, returnsResult] = await Promise.all([
    supabase
      .from('purchases')
      .select('id, supplier_id, received_at, purchase_items(medicine_id, medicines(name))')
      .eq('pharmacy_id', pharmacyId),
    supabase
      .from('returns')
      .select('supplier_id')
      .eq('pharmacy_id', pharmacyId)
      .eq('status', 'PENDING'),
  ]);
  if (purchasesResult.error) {
    throw ApiError.internal(`Could not load supplier purchases: ${purchasesResult.error.message}`);
  }
  if (returnsResult.error) {
    throw ApiError.internal(`Could not load supplier returns: ${returnsResult.error.message}`);
  }

  const medicineIdsBySupplier = new Map<string, Set<string>>();
  for (const row of (purchasesResult.data as unknown as {
    id: string;
    supplier_id: string | null;
    received_at: string;
    purchase_items: { medicine_id: string; medicines: { name: string } | null }[];
  }[]) ?? []) {
    if (!row.supplier_id) continue;
    const aggregate = result.get(row.supplier_id);
    if (!aggregate) continue;
    if (!aggregate.lastOrderAt || row.received_at > aggregate.lastOrderAt) {
      aggregate.lastOrderAt = row.received_at;
    }
    const names = medicineIdsBySupplier.get(row.supplier_id) ?? new Set<string>();
    for (const item of row.purchase_items ?? []) {
      names.add(item.medicine_id);
      if (aggregate.medicineNames.length < MEDICINE_NAMES_CAP) {
        const label = item.medicines?.name;
        if (label && !aggregate.medicineNames.includes(label)) {
          aggregate.medicineNames.push(label);
        }
      }
    }
    medicineIdsBySupplier.set(row.supplier_id, names);
  }
  for (const [id, names] of medicineIdsBySupplier) {
    const aggregate = result.get(id);
    if (aggregate) aggregate.medicinesSupplied = names.size;
  }

  for (const row of (returnsResult.data as unknown as { supplier_id: string | null }[]) ?? []) {
    if (row.supplier_id) {
      const aggregate = result.get(row.supplier_id);
      if (aggregate) aggregate.pendingReturns += 1;
    }
  }

  return result;
}

function mapSupplier(row: SupplierRow, aggregate: SupplierAggregate) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    ...aggregate,
  };
}

export async function listSuppliers(
  pharmacyId: string,
  includeArchived: boolean,
): Promise<SupplierListResponse> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('suppliers')
    .select('*')
    .eq('pharmacy_id', pharmacyId)
    .order('name', { ascending: true });
  if (!includeArchived) query = query.eq('is_archived', false);

  const { data, error } = await query;
  if (error) throw ApiError.internal(`Could not load suppliers: ${error.message}`);

  const rows = (data as unknown as SupplierRow[]) ?? [];
  const aggregates = await buildAggregate(supabase, pharmacyId, rows.map((row) => row.id));

  return {
    suppliers: rows.map((row) => mapSupplier(row, aggregates.get(row.id) ?? {
      medicinesSupplied: 0,
      medicineNames: [],
      lastOrderAt: null,
      pendingReturns: 0,
    })),
    total: rows.length,
  };
}

export async function getSupplier(
  pharmacyId: string,
  supplierId: string,
): Promise<SupplierDetail> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', supplierId)
    .eq('pharmacy_id', pharmacyId)
    .maybeSingle();
  if (error) throw ApiError.internal(`Could not load the supplier: ${error.message}`);
  if (!data) throw ApiError.notFound('Supplier could not be found.');

  const row = data as unknown as SupplierRow;
  const aggregates = await buildAggregate(supabase, pharmacyId, [row.id]);
  let recentPurchases: PurchaseListItem[] = [];
  try {
    const response = await listPurchases(pharmacyId, { page: 1, pageSize: 5 });
    recentPurchases = response.purchases.filter((purchase) => purchase.supplierId === row.id);
  } catch {
    recentPurchases = []; // Detail page stays useful without purchase history.
  }

  return {
    ...mapSupplier(row, aggregates.get(row.id) ?? {
      medicinesSupplied: 0,
      medicineNames: [],
      lastOrderAt: null,
      pendingReturns: 0,
    }),
    recentPurchases,
  };
}

export async function createSupplier(
  pharmacyId: string,
  userId: string,
  input: CreateSupplierInput,
  request: Request,
) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      pharmacy_id: pharmacyId,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
    })
    .select('*')
    .single();
  if (error) {
    throw ApiError.badRequest(`Could not create the supplier: ${error.message}`);
  }

  const row = data as unknown as SupplierRow;
  await writeAudit({
    pharmacyId,
    userId,
    action: 'supplier.created',
    entityType: 'supplier',
    entityId: row.id,
    after: { name: row.name, phone: row.phone, email: row.email },
    request,
  });

  return mapSupplier(row, {
    medicinesSupplied: 0,
    medicineNames: [],
    lastOrderAt: null,
    pendingReturns: 0,
  });
}

export async function updateSupplier(
  pharmacyId: string,
  userId: string,
  supplierId: string,
  input: UpdateSupplierInput,
  request: Request,
) {
  const supabase = getSupabaseAdmin();
  const { data: existing, error: existingError } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', supplierId)
    .eq('pharmacy_id', pharmacyId)
    .maybeSingle();
  if (existingError) throw ApiError.internal(`Could not load the supplier: ${existingError.message}`);
  if (!existing) throw ApiError.notFound('Supplier could not be found.');
  const before = existing as unknown as SupplierRow;

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.email !== undefined) patch.email = input.email;
  if (input.address !== undefined) patch.address = input.address;
  if (input.isArchived !== undefined) patch.is_archived = input.isArchived;

  if (Object.keys(patch).length === 0) {
    throw ApiError.badRequest('Nothing to update.');
  }

  const { data, error } = await supabase
    .from('suppliers')
    .update(patch)
    .eq('id', supplierId)
    .eq('pharmacy_id', pharmacyId)
    .select('*')
    .single();
  if (error) throw ApiError.badRequest(`Could not update the supplier: ${error.message}`);

  const row = data as unknown as SupplierRow;
  await writeAudit({
    pharmacyId,
    userId,
    action: 'supplier.updated',
    entityType: 'supplier',
    entityId: row.id,
    before: { name: before.name, phone: before.phone, email: before.email, isArchived: before.is_archived },
    after: {
      name: row.name,
      phone: row.phone,
      email: row.email,
      isArchived: row.is_archived,
    },
    request,
  });

  return mapSupplier(row, {
    medicinesSupplied: 0,
    medicineNames: [],
    lastOrderAt: null,
    pendingReturns: 0,
  });
}
