import type {
  AlertSeverity,
  AlertStatus,
  AlertType,
  BatchStatus,
  MembershipStatus,
  OcrScanStatus,
  QuarantineItemStatus,
  RecallStatus,
  ReturnReason,
  ReturnStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
} from './enums';

/**
 * Database entity shapes (TRD §3), adapted to the Supabase tenant model
 * (architecture.md §6): credentials live in auth.users, application user
 * data lives in profiles, roles live in pharmacy_memberships.
 *
 * Timestamps are ISO strings on the wire.
 */

export interface Profile {
  id: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Pharmacy {
  id: string;
  name: string;
  ownerName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface PharmacyMembership {
  id: string;
  pharmacyId: string;
  userId: string;
  role: UserRole;
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  pharmacyId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Medicine {
  id: string;
  pharmacyId: string;
  name: string;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
  manufacturer: string | null;
  barcode: string | null;
  category: string | null;
  reorderLevel: number;
  safetyStock: number;
  purchasePrice: number | null;
  sellingPrice: number | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Batch {
  id: string;
  medicineId: string;
  pharmacyId: string;
  batchNo: string;
  manufacturingDate: string | null;
  expiryDate: string;
  quantity: number;
  receivedDate: string | null;
  purchasePrice: number | null;
  supplierId: string | null;
  status: BatchStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  pharmacyId: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Sale {
  id: string;
  pharmacyId: string;
  userId: string;
  medicineId: string;
  batchId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  soldAt: string;
  note: string | null;
  reversedAt: string | null;
  reversedBy: string | null;
}

export interface Purchase {
  id: string;
  pharmacyId: string;
  supplierId: string | null;
  invoiceNo: string | null;
  receivedAt: string;
  createdBy: string;
  note: string | null;
  createdAt: string;
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  medicineId: string;
  batchId: string;
  quantity: number;
  unitCost: number;
}

export interface Alert {
  id: string;
  pharmacyId: string;
  medicineId: string | null;
  batchId: string | null;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  status: AlertStatus;
  snoozedUntil: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

export interface Recall {
  id: string;
  pharmacyId: string;
  medicineId: string | null;
  batchNo: string | null;
  manufacturer: string | null;
  reason: string | null;
  status: RecallStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuarantineItem {
  id: string;
  pharmacyId: string;
  batchId: string;
  quantity: number;
  reason: string;
  status: QuarantineItemStatus;
  createdBy: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnRecord {
  id: string;
  pharmacyId: string;
  supplierId: string | null;
  batchId: string;
  quantity: number;
  reason: ReturnReason;
  status: ReturnStatus;
  notes: string | null;
  returnDate: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  pharmacyId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeData: unknown;
  afterData: unknown;
  metadata: unknown;
  createdAt: string;
}

export interface OcrScan {
  id: string;
  pharmacyId: string;
  userId: string;
  fileReference: string | null;
  storagePath: string | null;
  extractedData: unknown;
  confidence: number | null;
  status: OcrScanStatus;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Authenticated user summary returned by GET /auth/me and auth mutations. */
export interface AuthUserContext {
  userId: string;
  email: string;
  fullName: string;
  phone: string | null;
  memberships: Array<{
    pharmacyId: string;
    pharmacyName: string | null;
    role: UserRole;
    status: MembershipStatus;
  }>;
}
