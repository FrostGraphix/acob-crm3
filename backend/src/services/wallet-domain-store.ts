import { randomUUID } from "node:crypto";
import type { AuthenticatedRequest } from "../middleware/auth.js";

export type WalletActorRole =
  | "super_admin"
  | "admin"
  | "finance"
  | "ops_manager"
  | "vendor_manager"
  | "vendor_user"
  | "field_agent"
  | "unknown";

export type WalletPhaseKey =
  | "phase-0"
  | "phase-1"
  | "phase-2"
  | "phase-3"
  | "phase-4"
  | "phase-5"
  | "phase-6"
  | "phase-7";

export type VendorLifecycleStatus =
  | "credentials_issued"
  | "draft"
  | "pending_review"
  | "approved"
  | "active"
  | "suspended"
  | "rejected";
export type VendorKycStatus =
  | "not_started"
  | "submitted"
  | "under_review"
  | "approved"
  | "expired"
  | "rejected";

export type WalletLifecycleStatus = "pending" | "active" | "frozen" | "suspended";
export type FundingChannel =
  | "bank_transfer"
  | "cash_at_branch"
  | "payment_gateway"
  | "internal_transfer";
export type FundingRequestStatus =
  | "initiated"
  | "awaiting_proof"
  | "proof_uploaded"
  | "under_review"
  | "confirmed"
  | "posted"
  | "rejected"
  | "expired"
  | "cancelled";
export type PurchaseDeliveryMethod = "remote_send" | "token_generate";
export type PurchaseOrderStatus =
  | "reserved"
  | "processing"
  | "success"
  | "failed"
  | "reversed";
export type LedgerJournalType =
  | "funding"
  | "reserve"
  | "release"
  | "purchase"
  | "commission-accrual"
  | "settlement"
  | "manual-adjustment";
export type LedgerDirection = "debit" | "credit";
export type ReconciliationExceptionSeverity = "low" | "medium" | "high" | "critical";
export type ReconciliationExceptionStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "escalated";
export type ApprovalRequestStatus = "pending" | "approved" | "rejected" | "cancelled";
export type ApprovalRequestType =
  | "vendor_onboarding"
  | "purchase_reversal"
  | "wallet_manual_credit"
  | "wallet_credit_limit_change"
  | "wallet_freeze"
  | "wallet_unfreeze";

export interface WalletRequestContext {
  actorUserId: string;
  actorUsername: string;
  actorDisplayName: string;
  appRole: WalletActorRole;
  vendorId: string | null;
  siteCode: string | null;
  permissions: string[];
  authProvider: "legacy" | "supabase" | null;
  sessionId: string | null;
}

export interface WalletPhaseChecklist {
  key: WalletPhaseKey;
  title: string;
  timeframe: string;
  deliverables: string[];
  exitCriteria: string[];
}

export interface WalletImplementationChecklist {
  source: string;
  generatedAt: string;
  phases: WalletPhaseChecklist[];
}

export interface VendorInvitation {
  id: string;
  vendorId: string;
  username: string;
  loginIdentifier: string;
  role: "vendor_user" | "vendor_manager";
  authUserId: string | null;
  temporaryPasswordIssued: boolean;
  temporaryPasswordExpiresAt: string | null;
  forcePasswordChange: boolean;
  siteCode: string;
  issuedBy: string;
  issuedAt: string;
}

export interface VendorProfile {
  id: string;
  vendorCode: string;
  legalName: string | null;
  displayName: string | null;
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  alternateContactName: string | null;
  alternateContactPhone: string | null;
  businessAddress: string | null;
  registrationNumber: string | null;
  taxId: string | null;
  siteCode: string;
  status: VendorLifecycleStatus;
  invitedAt: string | null;
  invitedBy: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  suspendedAt: string | null;
  suspendedBy: string | null;
  suspensionReason: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankSortCode: string | null;
  walletId: string | null;
  riskScore: number;
  failedFundingProofCount: number;
  lastFundingProofFailureAt: string | null;
  kycCompleted: boolean;
  kycStatus: VendorKycStatus;
  kycDocumentCount: number;
  onboardingSubmittedAt: string | null;
  onboardingSubmittedBy: string | null;
  lastReviewedAt: string | null;
  lastReviewedBy: string | null;
  onboardingNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRequestRecord {
  id: string;
  requestType: ApprovalRequestType;
  vendorId: string;
  siteCode: string;
  status: ApprovalRequestStatus;
  summary: string;
  submittedAt: string;
  submittedBy: string;
  lastUpdatedAt: string;
  checkerId: string | null;
  checkerAt: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
}

export interface VendorSessionLogRecord {
  id: string;
  vendorId: string;
  authUserId: string | null;
  siteCode: string;
  sessionId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceFingerprintHash: string | null;
  businessDate: string;
  purchaseCountBusinessDay: number;
  recentPurchaseAttempts: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface VendorWallet {
  id: string;
  vendorId: string;
  siteCode: string;
  currency: "NGN";
  status: WalletLifecycleStatus;
  availableBalance: number;
  reservedBalance: number;
  totalFunded: number;
  totalPurchased: number;
  totalCommissionAccrued: number;
  totalCommissionSettled: number;
  creditLimit: number;
  frozenReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FundingRequestRecord {
  id: string;
  vendorId: string;
  walletId: string;
  siteCode: string;
  idempotencyKey: string;
  amount: number;
  channel: FundingChannel;
  reference: string;
  externalBankRef: string | null;
  proofFileName: string | null;
  proofDocumentId: string | null;
  proofUploadedAt: string | null;
  expiresAt: string | null;
  status: FundingRequestStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  approvedBy: string | null;
  reviewerNote: string | null;
  reviewedAt: string | null;
  postedAt: string | null;
}

export interface PurchaseOrderRecord {
  id: string;
  vendorId: string;
  walletId: string;
  siteCode: string;
  idempotencyKey: string;
  meterSn: string;
  customerRef: string;
  amount: number;
  deliveryMethod: PurchaseDeliveryMethod;
  deliveryDestination: string | null;
  tokenValue: string | null;
  remoteSendRef: string | null;
  receiptRef: string | null;
  status: PurchaseOrderStatus;
  actorUserId: string;
  upstreamEndpoint: string;
  upstreamStatus: "pending" | "stubbed_success" | "stubbed_failure" | "upstream_success" | "upstream_failure";
  failureCode: string | null;
  failureReason: string | null;
  reservedJournalId: string | null;
  finalJournalId: string | null;
  releasedJournalId: string | null;
  receiptId: string | null;
  createdAt: string;
  updatedAt: string;
  reservedAt: string;
  settledAt: string | null;
  metadata: Record<string, unknown>;
}

export interface WalletReceiptRecord {
  id: string;
  purchaseOrderId: string;
  vendorId: string;
  siteCode: string;
  deliveryMethod: PurchaseDeliveryMethod;
  meterSn: string;
  customerRef: string | null;
  amount: number;
  tokenValue: string | null;
  remoteSendRef: string | null;
  issuedAt: string;
  receiptNumber: string;
  issuedBy: string;
  printableContent: string;
}

export interface CommissionRuleRecord {
  vendorId: string;
  rate: number;
  overrideSource: "default" | "vendor_override";
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEntryRecord {
  id: string;
  journalId: string;
  walletId: string;
  vendorId: string;
  siteCode: string;
  accountCode: string;
  direction: LedgerDirection;
  amount: number;
  description: string;
  reference: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface LedgerJournalRecord {
  id: string;
  walletId: string;
  vendorId: string;
  siteCode: string;
  journalType: LedgerJournalType;
  reference: string;
  status: "posted";
  postedBy: string;
  amount: number;
  createdAt: string;
  metadata: Record<string, unknown>;
  entries: LedgerEntryRecord[];
}

export interface ReconciliationExceptionRecord {
  id: string;
  type:
    | "balance_drift"
    | "stuck_reservation"
    | "local_success_upstream_missing"
    | "upstream_success_local_fail"
    | "funding_confirmation_missing"
    | "funding_unmatched"
    | "commission_mismatch"
    | "manual_review_required";
  severity: ReconciliationExceptionSeverity;
  status: ReconciliationExceptionStatus;
  siteCode: string;
  vendorId: string | null;
  walletId: string | null;
  purchaseOrderId: string | null;
  fundingRequestId: string | null;
  summary: string;
  details: Record<string, unknown>;
  detectedAt: string;
  dueAt: string;
  assignee: string | null;
  escalatedAt: string | null;
  escalationReason: string | null;
  resolutionCode: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface ReconciliationStageSummary {
  level: "L1" | "L2" | "L3" | "L4" | "L5";
  checked: number;
  exceptions: number;
}

export interface ReconciliationRunRecord {
  id: string;
  triggeredBy: string;
  businessDate: string;
  status: "completed" | "failed";
  startedAt: string;
  completedAt: string;
  stageSummaries: ReconciliationStageSummary[];
  exceptionCount: number;
  dryRun: boolean;
  reportLockedAt: string | null;
}

export interface SettlementBatchRecord {
  id: string;
  businessDate: string;
  status: "preview" | "posted" | "failed";
  totalCommissionCredits: number;
  itemCount: number;
  createdAt: string;
  postedAt: string | null;
  createdBy?: string | null;
  siteBreakdown?: Array<{
    siteCode: string;
    totalCommissionCredits: number;
    itemCount: number;
  }>;
}

export interface WalletOperationalAlertRecord {
  id: string;
  category:
    | "near_exhaustion"
    | "exception_escalated"
    | "wallet_auto_freeze"
    | "funding_rate_limit"
    | "purchase_rate_limit"
    | "fraud_review";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  source: string;
  siteCode: string | null;
  vendorId: string | null;
  walletId: string | null;
  createdAt: string;
  dedupeKey: string;
  metadata: Record<string, unknown>;
}

interface WalletDomainState {
  invitations: Map<string, VendorInvitation>;
  vendors: Map<string, VendorProfile>;
  approvalRequests: Map<string, ApprovalRequestRecord>;
  vendorSessionLogs: Map<string, VendorSessionLogRecord>;
  wallets: Map<string, VendorWallet>;
  fundingRequests: Map<string, FundingRequestRecord>;
  purchaseOrders: Map<string, PurchaseOrderRecord>;
  receipts: Map<string, WalletReceiptRecord>;
  commissionRules: Map<string, CommissionRuleRecord>;
  ledgerJournals: Map<string, LedgerJournalRecord>;
  reconciliationExceptions: Map<string, ReconciliationExceptionRecord>;
  reconciliationRuns: ReconciliationRunRecord[];
  settlementBatches: SettlementBatchRecord[];
  operationalAlerts: WalletOperationalAlertRecord[];
  idempotencyResults: Map<string, unknown>;
  inFlightIdempotency: Map<string, Promise<unknown>>;
  receiptSequence: number;
}

function createInitialState(): WalletDomainState {
  return {
    invitations: new Map<string, VendorInvitation>(),
    vendors: new Map<string, VendorProfile>(),
    approvalRequests: new Map<string, ApprovalRequestRecord>(),
    vendorSessionLogs: new Map<string, VendorSessionLogRecord>(),
    wallets: new Map<string, VendorWallet>(),
    fundingRequests: new Map<string, FundingRequestRecord>(),
    purchaseOrders: new Map<string, PurchaseOrderRecord>(),
    receipts: new Map<string, WalletReceiptRecord>(),
    commissionRules: new Map<string, CommissionRuleRecord>(),
    ledgerJournals: new Map<string, LedgerJournalRecord>(),
    reconciliationExceptions: new Map<string, ReconciliationExceptionRecord>(),
    reconciliationRuns: [],
    settlementBatches: [],
    operationalAlerts: [],
    idempotencyResults: new Map<string, unknown>(),
    inFlightIdempotency: new Map<string, Promise<unknown>>(),
    receiptSequence: 100000,
  };
}

let walletDomainState = createInitialState();

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeRole(value: string | null): WalletActorRole {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized.includes("super")) {
    return "super_admin";
  }
  if (normalized.includes("finance")) {
    return "finance";
  }
  if (normalized.includes("ops")) {
    return "ops_manager";
  }
  if (normalized.includes("vendor manager")) {
    return "vendor_manager";
  }
  if (normalized.includes("vendor")) {
    return "vendor_user";
  }
  if (normalized.includes("field")) {
    return "field_agent";
  }
  if (normalized.includes("admin")) {
    return "admin";
  }
  return "unknown";
}

function readContextField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = readString(record[key]);
    if (value) {
      return value;
    }
  }

  return null;
}

function toDateStamp(value: Date) {
  return value.toISOString().slice(0, 10).replace(/-/g, "");
}

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeCode(value: string) {
  return value.trim().replace(/\s+/g, "_").toUpperCase();
}

export function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

export function getWalletDomainState() {
  return walletDomainState;
}

export function resetWalletDomainState() {
  walletDomainState = createInitialState();
}

export function createWalletRequestContext(
  request: AuthenticatedRequest,
  hints: Record<string, unknown> = {},
): WalletRequestContext {
  const userRecord = (request.authSession?.user ?? {}) as Record<string, unknown>;
  const hintRecord = hints;
  const actorUsername =
    readContextField(userRecord, ["username"]) ??
    readContextField(hintRecord, ["actorUsername"]) ??
    "unknown";
  const actorUserId =
    readContextField(userRecord, ["id", "auth_user_id", "authUserId"]) ??
    actorUsername;
  const roleHint =
    readContextField(userRecord, ["app_role", "appRole", "role"]) ??
    readContextField(hintRecord, ["app_role", "appRole", "role"]);
  const appRole = normalizeRole(roleHint);
  const vendorId =
    readContextField(userRecord, ["vendor_id", "vendorId"]) ??
    readContextField(hintRecord, ["vendor_id", "vendorId"]) ??
    null;
  const siteCode =
    readContextField(userRecord, ["site_code", "siteCode"]) ??
    readContextField(hintRecord, ["site_code", "siteCode"]) ??
    null;

  return {
    actorUserId,
    actorUsername,
    actorDisplayName:
      readContextField(userRecord, ["displayName", "display_name"]) ?? actorUsername,
    appRole,
    vendorId,
    siteCode: siteCode ? normalizeCode(siteCode) : null,
    permissions: Array.isArray(request.authSession?.user.permissions)
      ? request.authSession?.user.permissions.filter(
          (permission): permission is string =>
            typeof permission === "string" && permission.trim().length > 0,
        )
      : [],
    authProvider: request.authProvider ?? null,
    sessionId: request.authSession?.sessionId ?? null,
  };
}

export const walletImplementationChecklist: WalletImplementationChecklist = {
  source: "docs/ACOB_Vendor_Wallet_SOP_v2.md",
  generatedAt: nowIso(),
  phases: [
    {
      key: "phase-0",
      title: "Foundation",
      timeframe: "Week 1-2",
      deliverables: [
        "JWT claim structure with app_role, site_code, vendor_id",
        "RBAC middleware and site-scoped authorization checks",
        "Vendor credential creation flow and audit hooks",
        "Commission rule seed at rate 0.00",
      ],
      exitCriteria: [
        "Admin can issue vendor credentials scoped to a site",
        "Vendor cannot read customer data outside assigned site",
        "Ledger remains service-role write only",
        "Default commission rule exists at 0.00",
      ],
    },
    {
      key: "phase-1",
      title: "Onboarding + Wallet Provisioning",
      timeframe: "Week 3-4",
      deliverables: [
        "Forced first-login password reset flow",
        "Vendor onboarding status machine draft -> pending_review -> approved -> active",
        "Finance approval queue",
        "Automatic wallet, limit policy, and commission profile provisioning",
      ],
      exitCriteria: [
        "Vendor completes onboarding and finance approves",
        "Wallet provisions automatically on approval",
        "Dashboard balance loads at zero",
        "Inactive vendors cannot purchase",
      ],
    },
    {
      key: "phase-2",
      title: "Funding",
      timeframe: "Week 5-6",
      deliverables: [
        "Funding request initiation with unique reference",
        "Proof upload and finance approval workflow",
        "Ledger posting from platform_cash_clearing to vendor_float",
        "Live balance refresh and funding history",
      ],
      exitCriteria: [
        "Funding approval posts exactly once",
        "Wallet balance refreshes immediately after posting",
        "Duplicate funding reference is rejected",
        "Statement reconciles after funding",
      ],
    },
    {
      key: "phase-3",
      title: "Purchase + Dual Delivery",
      timeframe: "Week 7-9",
      deliverables: [
        "Site-scoped meter search with no vendor site selector",
        "Shared reservation and balance validation service",
        "Dedicated remote-send and token-generate purchase endpoints",
        "Receipt retrieval and print-friendly rendering",
        "Zero-amount commission accrual on successful purchases",
      ],
      exitCriteria: [
        "Remote-send debits once and issues remote receipt",
        "Token-generate debits once and issues token receipt",
        "Failed purchases release reservation inside reconciliation window",
        "Upstream reference is stored for every successful purchase",
      ],
    },
    {
      key: "phase-4",
      title: "Reconciliation + Exceptions",
      timeframe: "Week 10-11",
      deliverables: [
        "Intraday and end-of-day reconciliation runs",
        "L1-L3 exception detection for ledger, purchase, and funding flows",
        "Exception board with severity and SLA fields",
        "Resolution workflow with audit-ready notes",
      ],
      exitCriteria: [
        "Stuck reservations detected within 15 minutes",
        "Injected upstream/local mismatch raises exception",
        "Finance resolves exception end-to-end without database access",
        "Daily reconciliation report is locked per business date",
      ],
    },
    {
      key: "phase-5",
      title: "Commission + Settlement",
      timeframe: "Week 12-13",
      deliverables: [
        "Commission rule engine with vendor overrides",
        "Accrual postings to payable ledger",
        "Daily settlement batch into vendor_float",
        "Finance dashboard KPIs for float, reserves, and commission",
      ],
      exitCriteria: [
        "Accrual matches purchase output at configured rate",
        "Settlement batch posts correctly for non-zero test rate",
        "Zero-value accrual history reconciles after rate activation",
        "Finance KPI summaries load consistently",
      ],
    },
    {
      key: "phase-6",
      title: "Supabase-Authoritative Reads",
      timeframe: "Week 14",
      deliverables: [
        "Supabase-authoritative wallet reads with hydrate-on-miss behavior",
        "Restart-safe restoration for wallets, purchases, funding, receipts, and exceptions",
        "Schema-readiness fail-closed policy in production",
      ],
      exitCriteria: [
        "Process restart does not erase financial read state",
        "Production wallet routes fail closed when schema readiness is degraded",
        "Mirror-cache remains fallback only outside authoritative Supabase mode",
      ],
    },
    {
      key: "phase-7",
      title: "Hardening",
      timeframe: "Week 14-15",
      deliverables: [
        "Maker-checker approvals for sensitive wallet actions",
        "Auto-suspend triggers for fraud and compliance events",
        "Per-vendor rate limiting and device/IP logging",
        "Concurrency, idempotency, and recovery stress tests",
      ],
      exitCriteria: [
        "Same idempotency key never double-posts money movement",
        "Auto-suspend fires after repeated failed funding proofs",
        "Concurrent purchase race test blocks double-debit",
        "Operations team can manage exceptions without direct DB access",
      ],
    },
  ],
};

export function nextReceiptNumber() {
  const next = walletDomainState.receiptSequence;
  walletDomainState.receiptSequence += 1;
  return `RCP-${toDateStamp(new Date())}-${String(next).padStart(6, "0")}`;
}

export function listWalletChecklists() {
  return {
    ...walletImplementationChecklist,
    generatedAt: nowIso(),
  };
}

export function listApprovalRequests() {
  return Array.from(walletDomainState.approvalRequests.values()).sort((left, right) =>
    right.submittedAt.localeCompare(left.submittedAt),
  );
}

export function findLatestApprovalRequestForVendor(
  vendorId: string,
  requestType?: ApprovalRequestType,
) {
  return listApprovalRequests().find(
    (request) => request.vendorId === vendorId && (!requestType || request.requestType === requestType),
  ) ?? null;
}

export function upsertCommissionRule(vendorId: string, rate = 0) {
  const now = nowIso();
  const existing = walletDomainState.commissionRules.get(vendorId);
  const record: CommissionRuleRecord = {
    vendorId,
    rate,
    overrideSource: existing ? existing.overrideSource : "default",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  walletDomainState.commissionRules.set(vendorId, record);
  return record;
}

export function ensureCommissionRule(vendorId: string) {
  return walletDomainState.commissionRules.get(vendorId) ?? upsertCommissionRule(vendorId, 0);
}

export function __walletDomainTestUtils() {
  return {
    reset: resetWalletDomainState,
    state: walletDomainState,
    agePurchaseOrder(orderId: string, minutesAgo: number) {
      const record = walletDomainState.purchaseOrders.get(orderId);
      if (!record) {
        return null;
      }

      const agedAt = new Date(Date.now() - minutesAgo * 60_000).toISOString();
      record.createdAt = agedAt;
      record.updatedAt = agedAt;
      record.reservedAt = agedAt;
      walletDomainState.purchaseOrders.set(orderId, record);
      return record;
    },
      insertReconciliationException(
        exception: Omit<
          ReconciliationExceptionRecord,
          "id" | "detectedAt" | "dueAt" | "status" | "escalatedAt" | "escalationReason" | "resolutionCode"
        >,
      ) {
        const record: ReconciliationExceptionRecord = {
          id: randomUUID(),
          status: "open",
          detectedAt: nowIso(),
          dueAt: new Date(Date.now() + 60 * 60_000).toISOString(),
          escalatedAt: null,
          escalationReason: null,
          resolutionCode: null,
          ...exception,
        };
      walletDomainState.reconciliationExceptions.set(record.id, record);
      return record;
    },
  };
}
