/**
 * Sales list contracts (PRD §10.10, TRD §7 Sales). The base `Sale` entity
 * lives in entities.ts (mirrors the immutable sales table - one row per
 * batch line, reversals stamped via reversed_at/reversed_by); this module
 * adds the joined history view.
 */

export interface SaleListItem {
  id: string;
  medicineId: string;
  medicineName: string;
  medicineStrength: string | null;
  batchId: string;
  batchNo: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  soldAt: string;
  note: string | null;
  reversedAt: string | null;
}

export interface SaleListResponse {
  sales: SaleListItem[];
  total: number;
  page: number;
  pageSize: number;
}
