import type { ReturnReason, ReturnStatus } from './enums';

/**
 * Returns + reorders view contracts (PRD §10.12/§10.14). The base Return
 * entity mirrors the returns table; ReorderRecommendation is the computed
 * TRD §11 view, ReorderRecord the persisted row.
 */

export interface ReturnListItem {
  id: string;
  supplierId: string | null;
  supplierName: string | null;
  batchId: string;
  batchNo: string;
  medicineId: string;
  medicineName: string;
  medicineStrength: string | null;
  quantity: number;
  reason: ReturnReason;
  status: ReturnStatus;
  notes: string | null;
  returnDate: string | null;
  createdAt: string;
}

export interface ReturnListResponse {
  returns: ReturnListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReorderRecommendation {
  medicineId: string;
  medicineName: string;
  medicineStrength: string | null;
  currentStock: number;
  reorderLevel: number;
  safetyStock: number;
  averageDailySales: number;
  leadTimeDays: number;
  estimatedStockoutDate: string | null;
  recommendedQuantity: number;
  explanation: string;
  sufficientHistory: boolean;
}

export interface ReorderRecommendationsResponse {
  observationDays: number;
  leadTimeDays: number;
  recommendations: ReorderRecommendation[];
}

export type ReorderStatus = 'SUGGESTED' | 'ORDERED' | 'RECEIVED' | 'DISMISSED';

export interface ReorderRecord {
  id: string;
  medicineId: string;
  medicineName: string;
  medicineStrength: string | null;
  supplierId: string | null;
  supplierName: string | null;
  status: ReorderStatus;
  observationDays: number;
  leadTimeDays: number;
  averageDailySales: number;
  currentStock: number;
  safetyStock: number;
  estimatedStockoutDate: string | null;
  recommendedQuantity: number;
  explanation: string;
  createdAt: string;
}

export interface ReorderListResponse {
  reorders: ReorderRecord[];
  total: number;
  page: number;
  pageSize: number;
}
