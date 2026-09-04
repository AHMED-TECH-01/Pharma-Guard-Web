import type { Request } from 'express';
import type {
  RecallAffectedBatch,
  RecallDetail,
  RecallListItem,
  RecallListResponse,
} from '@pharmaguard/types';
import type { CreateRecallInput, ListRecallsQuery, UpdateRecallInput } from '@pharmaguard/validation';
import { getSupabaseAdmin } from '../../database/supabase.js';
import { ApiError } from '../../utils/api-error.js';
import { writeAudit } from '../../utils/audit.js';
import { insertEventAlert } from './alert-engine.service.js';
import { classifyBatch } from './expiry.util.js';
import { quarantineBatch } from './quarantine.service.js';

/**
 * Recall Center service (PRD §10.16, FR-024).
 *
 * A recall record scopes affected stock by medicine and/or batch number.
 * "Quarantine affected inventory" quarantines every AVAILABLE matching batch
 * (reusing the quarantine workflow) and moves the recall to IN_PROGRESS.
 */

const RECALL_SELECT = `
  id, medicine_id, batch_no, manufacturer, reason, status, created_by,
  created_at, updated_at,
  medicines(name)
`;

type RecallRow = {
  id: string;
  medicine_id: string | null;
  batch_no: string | null;
  manufacturer: string | null;
  reason: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  medicines: { name: string } | null;
};

async function creatorNames(userIds: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .select('id, full_name')
    .in('id', unique);
  if (error) return new Map();
  return new Map((data as { id: string; full_name: string }[]).map((row) => [row.id, row.full_name]));
}

function mapRecall(row: RecallRow, names: Map<string, string>): RecallListItem {
  return {
    id: row.id,
    medicineId: row.medicine_id,
    medicineName: row.medicines?.name ?? null,
    batchNo: row.batch_no,
    manufacturer: row.manufacturer,
    reason: row.reason,
    status: row.status as RecallListItem['status'],
    createdByName: names.get(row.created_by ?? '') ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getRecallRow(pharmacyId: string, recallId: string): Promise<RecallRow> {
  const { data, error } = await getSupabaseAdmin()
    .from('recalls')
    .select(RECALL_SELECT)
    .eq('pharmacy_id', pharmacyId)
    .eq('id', recallId)
    .maybeSingle();
  if (error) throw ApiError.internal(`Could not load the recall: ${error.message}`);
  if (!data) throw ApiError.notFound('Recall not found');
  return data as unknown as RecallRow;
}

/** Batches matching the recall scope, FEFO-ordered, with expiry buckets. */
async function affectedBatches(pharmacyId: string, recall: RecallRow): Promise<RecallAffectedBatch[]> {
  let query = getSupabaseAdmin()
    .from('batches')
    .select('id, batch_no, quantity, expiry_date, status')
    .eq('pharmacy_id', pharmacyId)
    .neq('status', 'ARCHIVED')
    .order('expiry_date', { ascending: true });
  if (recall.medicine_id) query = query.eq('medicine_id', recall.medicine_id);
  if (recall.batch_no) query = query.eq('batch_no', recall.batch_no);
  // At least one scope must exist (enforced by createRecallSchema).
  if (!recall.medicine_id && !recall.batch_no) return [];

  const { data, error } = await query;
  if (error) throw ApiError.internal(`Could not load affected batches: ${error.message}`);

  const now = new Date();
  return (data as { id: string; batch_no: string; quantity: number; expiry_date: string; status: string }[]).map(
    (row) => {
      const { daysLeft, bucket } = classifyBatch(row.expiry_date, now);
      return {
        id: row.id,
        batchNo: row.batch_no,
        quantity: row.quantity,
        expiryDate: row.expiry_date,
        daysLeft,
        bucket,
        status: row.status,
      } satisfies RecallAffectedBatch;
    },
  );
}

export async function listRecalls(
  pharmacyId: string,
  query: ListRecallsQuery,
): Promise<RecallListResponse> {
  const supabase = getSupabaseAdmin();

  let listQuery = supabase
    .from('recalls')
    .select(RECALL_SELECT)
    .eq('pharmacy_id', pharmacyId)
    .order('created_at', { ascending: false })
    .range((query.page - 1) * query.pageSize, query.page * query.pageSize - 1);
  let countQuery = supabase
    .from('recalls')
    .select('id', { count: 'exact', head: true })
    .eq('pharmacy_id', pharmacyId);
  if (query.status !== 'ALL') {
    listQuery = listQuery.eq('status', query.status);
    countQuery = countQuery.eq('status', query.status);
  }

  const [listResult, countResult] = await Promise.all([listQuery, countQuery]);
  if (listResult.error) throw ApiError.internal(`Could not load recalls: ${listResult.error.message}`);
  if (countResult.error) throw ApiError.internal(`Could not count recalls: ${countResult.error.message}`);

  const rows = listResult.data as unknown as RecallRow[];
  const names = await creatorNames(rows.map((row) => row.created_by));

  return {
    recalls: rows.map((row) => mapRecall(row, names)),
    total: countResult.count ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getRecallDetail(pharmacyId: string, recallId: string): Promise<RecallDetail> {
  const row = await getRecallRow(pharmacyId, recallId);
  const names = await creatorNames([row.created_by]);
  return { ...mapRecall(row, names), affectedBatches: await affectedBatches(pharmacyId, row) };
}

export async function createRecall(
  pharmacyId: string,
  userId: string,
  input: CreateRecallInput,
  request?: Request,
): Promise<RecallDetail> {
  const supabase = getSupabaseAdmin();

  let medicineName: string | null = null;
  if (input.medicineId) {
    const { data: medicine, error: medicineError } = await supabase
      .from('medicines')
      .select('name')
      .eq('pharmacy_id', pharmacyId)
      .eq('id', input.medicineId)
      .maybeSingle();
    if (medicineError) throw ApiError.internal(`Could not verify the medicine: ${medicineError.message}`);
    if (!medicine) throw ApiError.badRequest('Selected medicine does not exist in this pharmacy');
    medicineName = (medicine as { name: string }).name;
  }

  const { data, error } = await supabase
    .from('recalls')
    .insert({
      pharmacy_id: pharmacyId,
      medicine_id: input.medicineId ?? null,
      batch_no: input.batchNo ?? null,
      manufacturer: input.manufacturer ?? null,
      reason: input.reason ?? null,
      status: 'OPEN',
      created_by: userId,
    })
    .select('id')
    .single();
  if (error) throw ApiError.internal(`Could not create the recall: ${error.message}`);
  const recallId = (data as { id: string }).id;

  await insertEventAlert(pharmacyId, {
    type: 'RECALL',
    severity: 'CRITICAL',
    title: `Recall: ${medicineName ?? input.batchNo ?? 'Inventory'}`,
    message: `A recall was recorded${medicineName ? ` for ${medicineName}` : ''}${input.batchNo ? ` (batch ${input.batchNo})` : ''}.${input.manufacturer ? ` Manufacturer: ${input.manufacturer}.` : ''} Review affected inventory and quarantine it.`,
    medicineId: input.medicineId ?? null,
    batchId: null,
  });

  await writeAudit({
    pharmacyId,
    userId,
    action: 'recall.created',
    entityType: 'recall',
    entityId: recallId,
    after: {
      medicineId: input.medicineId ?? null,
      batchNo: input.batchNo ?? null,
      manufacturer: input.manufacturer ?? null,
      reason: input.reason ?? null,
    },
    request,
  });

  return getRecallDetail(pharmacyId, recallId);
}

export async function updateRecallStatus(
  pharmacyId: string,
  userId: string,
  recallId: string,
  input: UpdateRecallInput,
  request?: Request,
): Promise<RecallDetail> {
  const row = await getRecallRow(pharmacyId, recallId);
  if (row.status === input.status) {
    return getRecallDetail(pharmacyId, recallId); // idempotent
  }

  const { error } = await getSupabaseAdmin()
    .from('recalls')
    .update({ status: input.status })
    .eq('id', recallId);
  if (error) throw ApiError.internal(`Could not update the recall: ${error.message}`);

  await writeAudit({
    pharmacyId,
    userId,
    action: 'recall.status_changed',
    entityType: 'recall',
    entityId: recallId,
    before: { status: row.status },
    after: { status: input.status },
    request,
  });

  return getRecallDetail(pharmacyId, recallId);
}

/**
 * Quarantines every AVAILABLE batch matching the recall scope (PRD §10.16
 * "Quarantine action") and advances an OPEN recall to IN_PROGRESS.
 */
export async function quarantineFromRecall(
  pharmacyId: string,
  userId: string,
  recallId: string,
  request?: Request,
): Promise<RecallDetail> {
  const row = await getRecallRow(pharmacyId, recallId);
  if (row.status === 'COMPLETED' || row.status === 'CANCELLED') {
    throw ApiError.conflict(`Recall is ${row.status.toLowerCase()} and can no longer be acted on`);
  }

  const targets = (await affectedBatches(pharmacyId, row)).filter(
    (batch) => batch.status === 'AVAILABLE' && batch.quantity > 0,
  );
  if (targets.length === 0) {
    throw ApiError.conflict('No available batches match this recall');
  }

  for (const batch of targets) {
    await quarantineBatch(
      pharmacyId,
      userId,
      {
        batchId: batch.id,
        reason: `Recall: ${row.reason ?? 'manufacturer recall'}${row.batch_no ? ` (batch ${row.batch_no})` : ''}`,
      },
      request,
    );
  }

  if (row.status === 'OPEN') {
    const { error } = await getSupabaseAdmin().from('recalls').update({ status: 'IN_PROGRESS' }).eq('id', recallId);
    if (error) throw ApiError.internal(`Could not update the recall: ${error.message}`);
  }

  await writeAudit({
    pharmacyId,
    userId,
    action: 'recall.quarantined',
    entityType: 'recall',
    entityId: recallId,
    after: { quarantinedBatches: targets.length },
    request,
  });

  return getRecallDetail(pharmacyId, recallId);
}
