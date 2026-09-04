/**
 * Purchases + suppliers view contracts (PRD §10.11/§10.13). Base Purchase,
 * PurchaseItem, and Supplier entities live in entities.ts; these are the
 * joined history/aggregate views used by the API responses and web pages.
 */

export interface PurchaseItemView {
  medicineId: string;
  medicineName: string;
  medicineStrength: string | null;
  batchId: string;
  batchNo: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseListItem {
  id: string;
  supplierId: string | null;
  supplierName: string | null;
  invoiceNo: string | null;
  receivedAt: string;
  note: string | null;
  items: PurchaseItemView[];
  totalCost: number;
}

export interface PurchaseListResponse {
  purchases: PurchaseListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SupplierListItem {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isArchived: boolean;
  createdAt: string;
  medicinesSupplied: number;
  medicineNames: string[];
  lastOrderAt: string | null;
  pendingReturns: number;
}

export interface SupplierListResponse {
  suppliers: SupplierListItem[];
  total: number;
}

export interface SupplierDetail extends SupplierListItem {
  recentPurchases: PurchaseListItem[];
}
