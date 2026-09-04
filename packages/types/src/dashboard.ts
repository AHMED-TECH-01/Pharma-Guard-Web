import type { AlertSeverity } from './enums';

/**
 * Dashboard contract (TRD §14, PRD §10.5). One aggregate payload served by
 * GET /api/v1/dashboard/summary so the dashboard renders from a single
 * round trip. All money values are PKR numbers.
 */

export interface DashboardKpis {
  /** Inventory value at cost: sum(qty * coalesce(batch, medicine) purchase price). */
  totalStockValue: number;
  expiringSoonBatches: number;
  expiredBatches: number;
  lowStockMedicines: number;
  outOfStockMedicines: number;
  todaySalesTotal: number;
  /** Percent change vs yesterday; null when yesterday had no sales baseline. */
  todaySalesDeltaPct: number | null;
}

export interface SalesTrendPoint {
  /** ISO date (YYYY-MM-DD) of the day bucket. */
  date: string;
  label: string;
  total: number;
}

export type ExpiryBucketKey = 'expired' | 'critical' | 'warning' | 'safe';

export interface ExpiryBucket {
  key: ExpiryBucketKey;
  label: string;
  count: number;
}

export interface ExpiryOverview {
  /** Available batches with quantity > 0. */
  totalBatches: number;
  buckets: ExpiryBucket[];
}

export interface StockStatus {
  inStock: number;
  lowStock: number;
  outOfStock: number;
  /** Batches past expiry still holding stock. */
  expired: number;
  /** Batches currently quarantined. */
  quarantined: number;
}

export interface LowStockItem {
  medicineId: string;
  name: string;
  strength: string | null;
  quantity: number;
  reorderLevel: number;
}

export interface ExpiringSoonItem {
  batchId: string;
  medicineName: string;
  strength: string | null;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  daysLeft: number;
}

export interface RecentSaleItem {
  saleId: string;
  medicineName: string;
  strength: string | null;
  batchNo: string;
  quantity: number;
  totalAmount: number;
  soldAt: string;
}

export interface AlertSummaryItem {
  alertId: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  createdAt: string;
}

export interface ActionCenterTask {
  id: string;
  severity: Extract<AlertSeverity, 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>;
  title: string;
  description: string;
  /** Destination route once the owning phase ships. */
  target: string;
}

export interface DashboardSummary {
  pharmacyId: string;
  pharmacyName: string | null;
  currency: string;
  generatedAt: string;
  kpis: DashboardKpis;
  salesTrend: SalesTrendPoint[];
  expiryOverview: ExpiryOverview;
  stockStatus: StockStatus;
  lowStockItems: LowStockItem[];
  expiringSoon: ExpiringSoonItem[];
  recentSales: RecentSaleItem[];
  recentAlerts: AlertSummaryItem[];
  unreadAlertsCount: number;
  actionCenter: ActionCenterTask[];
  /** 'rules' until Gemini integration lands in Phase 5. */
  aiSummarySource: 'rules' | 'gemini';
  aiSummary: string;
}
