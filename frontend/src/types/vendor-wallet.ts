import type {
  AuthUser,
  VendorOrganizationRecord,
  VendorStatus,
  VendorWalletRecord,
  WalletFundingStatus,
  WalletPurchaseDeliveryMethod,
  WalletPurchaseRequestPayload,
  WalletPurchaseResponse,
  WalletReceiptRecord,
  WalletStatus,
} from "../../../common/types";

export type VendorTransactionType =
  | "fund"
  | "purchase"
  | "reversal"
  | "commission"
  | "reservation"
  | "adjustment";

export interface VendorTransactionRecord {
  id: string;
  createdAt: string;
  type: VendorTransactionType;
  description: string;
  amount: number;
  direction: "debit" | "credit";
  balanceAfter: number | null;
  status: string;
  reference: string | null;
  receiptId: string | null;
  receiptNumber: string | null;
  meterSn: string | null;
  deliveryMethod: WalletPurchaseDeliveryMethod | null;
}

export interface VendorMeterSearchResult {
  id: string;
  customerName: string;
  customerRef: string;
  meterSn: string;
  meterType: string;
  accountStatus: string;
  siteCode: string;
  lastVendedAt: string | null;
}

export interface VendorDashboardResponse {
  wallet: VendorWalletRecord | null;
  vendor: Partial<VendorOrganizationRecord> & {
    vendorCode?: string | null;
    businessName?: string | null;
    siteName?: string | null;
    statusReason?: string | null;
    lastLoginAt?: string | null;
  };
  todayPurchaseCount: number;
  todayPurchaseAmount: number;
  recentTransactions: VendorTransactionRecord[];
  recentReceipts: WalletReceiptRecord[];
}

export interface VendorTransactionsQuery {
  search?: string;
  type?: VendorTransactionType | "all";
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export interface VendorTransactionsResponse {
  rows: VendorTransactionRecord[];
  total: number;
}

export interface VendorReceiptsQuery {
  search?: string;
  deliveryMethod?: WalletPurchaseDeliveryMethod | "all";
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export interface VendorReceiptsResponse {
  rows: WalletReceiptRecord[];
  total: number;
}

export interface VendorFundingRequestPayload {
  walletId: string;
  amount: number;
  channel: "bank_transfer" | "cash_branch" | "cash_at_branch";
  proofDocumentId?: string;
  idempotencyKey?: string;
}

export interface VendorFundingRequestRecord {
  id: string;
  walletId: string;
  vendorId: string;
  amount: number;
  channel: "bank_transfer" | "cash_branch" | "cash_at_branch";
  reference: string;
  status: WalletFundingStatus;
  proofDocumentId: string | null;
  idempotencyKey?: string;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VendorCommissionHistoryRecord {
  id: string;
  vendorId: string;
  walletId: string;
  type: "accrual" | "settlement";
  amount: number;
  rate: number | null;
  purchaseOrderId: string | null;
  businessDate: string | null;
  reference: string;
  createdAt: string;
}

export interface VendorCommissionSummaryResponse {
  rule: {
    vendorId: string;
    rate: number;
    overrideSource: "default" | "vendor_override";
    createdAt: string;
    updatedAt: string;
  };
  totalAccrued: number;
  totalSettled: number;
  totalOutstanding: number;
  accrualCount: number;
  settlementCount: number;
  latestAccruedAt: string | null;
  latestSettledAt: string | null;
  history: {
    rows: VendorCommissionHistoryRecord[];
    total: number;
  };
}

export interface VendorStatementQuery {
  fromDate: string;
  toDate: string;
}

export interface VendorStatementRecord {
  id: string;
  createdAt: string;
  reference: string;
  description: string;
  type: VendorTransactionType;
  debit: number;
  credit: number;
  balanceAfter: number;
}

export interface VendorStatementResponse {
  rows: VendorStatementRecord[];
  total: number;
}

export interface VendorProfileResponse {
  user: AuthUser;
  vendor: Partial<VendorOrganizationRecord> & {
    vendorCode?: string | null;
    businessName?: string | null;
    legalName?: string | null;
    displayName?: string | null;
    bankName?: string | null;
    accountName?: string | null;
    accountNumberMasked?: string | null;
    bankSortCode?: string | null;
    businessAddress?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    alternateContactName?: string | null;
    alternateContactPhone?: string | null;
    registrationNumber?: string | null;
    taxId?: string | null;
    kycStatus?: string | null;
    kycDocumentCount?: number | null;
    onboardingSubmittedAt?: string | null;
    onboardingNotes?: string | null;
    siteName?: string | null;
  };
  wallet: Pick<
    VendorWalletRecord,
    "id" | "walletNumber" | "status" | "availableBalance" | "reservedBalance"
  > | null;
}

export interface VendorOnboardingPayload {
  vendorId: string;
  vendorCode: string;
  businessName: string;
  legalName?: string;
  displayName?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  alternateContactName?: string;
  alternateContactPhone?: string;
  businessAddress?: string;
  registrationNumber?: string;
  taxId?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankSortCode?: string;
  kycDocumentCount?: number;
  submitForReview?: boolean;
  onboardingNotes?: string;
}

export interface VendorPurchaseDraft extends WalletPurchaseRequestPayload {
  customerName: string;
  meterType: string;
  accountStatus: string;
  deliveryMethod: WalletPurchaseDeliveryMethod;
  availableBalance: number;
  walletStatus: WalletStatus | null;
  vendorStatus: VendorStatus;
}

export interface VendorReceiptDetailResponse {
  receipt: WalletReceiptRecord & {
    customerName?: string | null;
    vendorName?: string | null;
    vendorCode?: string | null;
    siteName?: string | null;
    statusLabel?: string | null;
  };
  purchase?: Pick<WalletPurchaseResponse, "purchaseId" | "status" | "deliveryMethod"> | null;
}

export interface VendorPhaseChecklistItem {
  phase: string;
  focus: string;
  tasks: string[];
}
