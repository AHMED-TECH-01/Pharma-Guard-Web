/**
 * Analytics contracts (PRD §10.17, TRD §7 Analytics). Margins are reported
 * only when purchase prices exist ("profit/margin when configured"); the
 * health score is a transparent penalty model documented in the service.
 */

export interface AnalyticsOverview {
  pharmacyId: string;
  generatedAt: string;
  salesToday: number;
  salesYesterday: number;
  salesDeltaPct: number | null;
  revenue30d: number;
  unitsSold30d: number;
  grossMargin30d: number | null;
  marginPct: number | null;
  inventoryValue: number;
  healthScore: number;
  healthNotes: string[];
}

export interface MoverItem {
  medicineId: string;
  medicineName: string;
  medicineStrength: string | null;
  unitsSold: number;
  revenue: number;
  margin: number | null;
}

export interface AnalyticsSales {
  observationDays: number;
  trend: { date: string; label: string; total: number }[];
  fastMovers: MoverItem[];
}

export interface SlowMoverItem {
  medicineId: string;
  medicineName: string;
  medicineStrength: string | null;
  currentStock: number;
  unitsSold30d: number;
  valueAtCost: number;
}

export interface DeadStockItem {
  medicineId: string;
  medicineName: string;
  medicineStrength: string | null;
  currentStock: number;
  unitsSold60d: number;
  valueAtCost: number;
}

export interface OverstockItem {
  medicineId: string;
  medicineName: string;
  medicineStrength: string | null;
  currentStock: number;
  threshold: number;
  excessUnits: number;
  valueAtCost: number;
}

export interface AnalyticsInventory {
  inventoryValue: number;
  totalUnits: number;
  slowMovers: SlowMoverItem[];
  deadStock: DeadStockItem[];
  overstock: OverstockItem[];
}

export interface AnalyticsReorders {
  statusCounts: { suggested: number; ordered: number; received: number; dismissed: number };
  createdPerDay: { date: string; label: string; count: number }[];
  urgentCount: number;
}
