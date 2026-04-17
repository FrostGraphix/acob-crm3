import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";
import { isSupabaseDbEnabled } from "./supabase-db.js";
import {
  getWalletDomainState,
  normalizeCode,
  type ApprovalRequestRecord,
  type CommissionRuleRecord,
  type FundingRequestRecord,
  type LedgerJournalRecord,
  type PurchaseOrderRecord,
  type ReconciliationExceptionRecord,
  type ReconciliationRunRecord,
  type SettlementBatchRecord,
  type VendorInvitation,
  type VendorProfile,
  type VendorSessionLogRecord,
  type VendorWallet,
  type WalletReceiptRecord,
} from "./wallet-domain-store.js";

type SupabaseModule = typeof import("@supabase/supabase-js");

let supabaseModulePromise: Promise<SupabaseModule> | null = null;
let walletDbClientPromise: Promise<SupabaseClient> | null = null;
let walletSchemaReady: boolean | null = null;
let walletSchemaCheckedAt = 0;

const WALLET_SCHEMA_CHECK_TTL_MS = 60_000;

export interface WalletPersistenceReadiness {
  configured: boolean;
  schemaReady: boolean;
  mode: "disabled" | "degraded" | "ready";
}

interface WalletPersistenceMirrorState {
  invitations: Map<string, VendorInvitation>;
  approvalRequests: Map<string, ApprovalRequestRecord>;
  vendorSessionLogs: Map<string, VendorSessionLogRecord>;
  vendors: Map<string, VendorProfile>;
  wallets: Map<string, VendorWallet>;
  fundingRequests: Map<string, FundingRequestRecord>;
  purchaseOrders: Map<string, PurchaseOrderRecord>;
  receipts: Map<string, WalletReceiptRecord>;
  commissionRules: Map<string, CommissionRuleRecord>;
  ledgerJournals: Map<string, LedgerJournalRecord>;
  reconciliationExceptions: Map<string, ReconciliationExceptionRecord>;
  reconciliationRuns: ReconciliationRunRecord[];
  settlementBatches: SettlementBatchRecord[];
  receiptSequence: number;
}

interface WalletPersistenceSnapshot {
  invitations: VendorInvitation[];
  approvalRequests: ApprovalRequestRecord[];
  vendorSessionLogs: VendorSessionLogRecord[];
  vendors: VendorProfile[];
  wallets: VendorWallet[];
  fundingRequests: FundingRequestRecord[];
  purchaseOrders: PurchaseOrderRecord[];
  receipts: WalletReceiptRecord[];
  commissionRules: CommissionRuleRecord[];
  ledgerJournals: LedgerJournalRecord[];
  reconciliationExceptions: ReconciliationExceptionRecord[];
  reconciliationRuns: ReconciliationRunRecord[];
  settlementBatches: SettlementBatchRecord[];
  receiptSequence: number;
  source: "mirror-cache" | "supabase";
}

interface WalletHydrationResult {
  hydrated: boolean;
  source: "mirror-cache" | "supabase" | "in-memory";
  loaded: number;
}

function createMirrorState(): WalletPersistenceMirrorState {
  return {
    invitations: new Map<string, VendorInvitation>(),
    approvalRequests: new Map<string, ApprovalRequestRecord>(),
    vendorSessionLogs: new Map<string, VendorSessionLogRecord>(),
    vendors: new Map<string, VendorProfile>(),
    wallets: new Map<string, VendorWallet>(),
    fundingRequests: new Map<string, FundingRequestRecord>(),
    purchaseOrders: new Map<string, PurchaseOrderRecord>(),
    receipts: new Map<string, WalletReceiptRecord>(),
    commissionRules: new Map<string, CommissionRuleRecord>(),
    ledgerJournals: new Map<string, LedgerJournalRecord>(),
    reconciliationExceptions: new Map<string, ReconciliationExceptionRecord>(),
    reconciliationRuns: [],
    settlementBatches: [],
    receiptSequence: 100000,
  };
}

let walletMirrorState = createMirrorState();

function normalizeSiteCode(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeVendorCode(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function isUuid(value: string | null | undefined) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  );
}

function nullableUuid(value: string | null | undefined) {
  return isUuid(value) ? value : null;
}

function toVendorDbStatus(status: VendorProfile["status"]) {
  if (status === "credentials_issued") {
    return "draft";
  }

  return status;
}

function toPurchaseDbStatus(status: PurchaseOrderRecord["status"]) {
  if (status === "success") {
    return "successful";
  }

  return status;
}

function toFundingDbStatus(status: FundingRequestRecord["status"]) {
  return status;
}

function inferRiskRating(score: number) {
  if (score >= 50) {
    return "high";
  }
  if (score >= 20) {
    return "medium";
  }
  return "standard";
}

async function getSupabaseModule() {
  if (!supabaseModulePromise) {
    supabaseModulePromise = import("@supabase/supabase-js");
  }

  return supabaseModulePromise;
}

async function getWalletDbClient(): Promise<SupabaseClient> {
  if (!isSupabaseDbEnabled()) {
    throw new Error("Supabase DB is not configured for wallet persistence");
  }

  if (!walletDbClientPromise) {
    walletDbClientPromise = (async () => {
      const { createClient } = await getSupabaseModule();
      return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      });
    })();
  }

  return walletDbClientPromise;
}

async function isWalletSchemaReady() {
  if (!isSupabaseDbEnabled()) {
    return false;
  }

  if (
    walletSchemaReady !== null &&
    Date.now() - walletSchemaCheckedAt < WALLET_SCHEMA_CHECK_TTL_MS
  ) {
    return walletSchemaReady;
  }

  try {
    const client = await getWalletDbClient();
    const { error } = await client.from("vendor_organizations").select("id").limit(1);
    walletSchemaCheckedAt = Date.now();

    if (!error) {
      walletSchemaReady = true;
      return true;
    }

    if (error.message.includes("Could not find the table")) {
      walletSchemaReady = false;
      return false;
    }

    throw new Error(`Failed to validate wallet schema: ${error.message}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Could not find the table")) {
      walletSchemaReady = false;
      walletSchemaCheckedAt = Date.now();
      return false;
    }

    throw error;
  }
}

export async function getWalletPersistenceReadiness(): Promise<WalletPersistenceReadiness> {
  if (!isSupabaseDbEnabled()) {
    return {
      configured: false,
      schemaReady: false,
      mode: "disabled",
    };
  }

  const schemaReady = await isWalletSchemaReady();
  return {
    configured: true,
    schemaReady,
    mode: schemaReady ? "ready" : "degraded",
  };
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function upsertMirrorMapRecord<TKey extends string, TValue>(
  map: Map<TKey, TValue>,
  key: TKey,
  value: TValue,
) {
  map.set(key, cloneValue(value));
}

function replaceMirrorArrayRecord<TValue extends { id: string }>(
  rows: TValue[],
  value: TValue,
) {
  const cloned = cloneValue(value);
  const index = rows.findIndex((row) => row.id === cloned.id);
  if (index >= 0) {
    rows[index] = cloned;
    return;
  }

  rows.push(cloned);
}

function updateMirrorReceiptSequence(receiptNumber: string) {
  const sequence = Number(receiptNumber.split("-").pop());
  if (Number.isFinite(sequence)) {
    walletMirrorState.receiptSequence = Math.max(walletMirrorState.receiptSequence, sequence);
  }
}

function readMirrorSnapshot(): WalletPersistenceSnapshot {
  return {
    invitations: Array.from(walletMirrorState.invitations.values()).map(cloneValue),
    approvalRequests: Array.from(walletMirrorState.approvalRequests.values()).map(cloneValue),
    vendorSessionLogs: Array.from(walletMirrorState.vendorSessionLogs.values()).map(cloneValue),
    vendors: Array.from(walletMirrorState.vendors.values()).map(cloneValue),
    wallets: Array.from(walletMirrorState.wallets.values()).map(cloneValue),
    fundingRequests: Array.from(walletMirrorState.fundingRequests.values()).map(cloneValue),
    purchaseOrders: Array.from(walletMirrorState.purchaseOrders.values()).map(cloneValue),
    receipts: Array.from(walletMirrorState.receipts.values()).map(cloneValue),
    commissionRules: Array.from(walletMirrorState.commissionRules.values()).map(cloneValue),
    ledgerJournals: Array.from(walletMirrorState.ledgerJournals.values()).map(cloneValue),
    reconciliationExceptions: Array.from(walletMirrorState.reconciliationExceptions.values()).map(cloneValue),
    reconciliationRuns: walletMirrorState.reconciliationRuns.map(cloneValue),
    settlementBatches: walletMirrorState.settlementBatches.map(cloneValue),
    receiptSequence: walletMirrorState.receiptSequence,
    source: "mirror-cache",
  };
}

function applySnapshotToDomain(snapshot: WalletPersistenceSnapshot) {
  const state = getWalletDomainState();
  state.invitations = new Map(snapshot.invitations.map((entry) => [entry.vendorId, cloneValue(entry)]));
  state.approvalRequests = new Map(snapshot.approvalRequests.map((entry) => [entry.id, cloneValue(entry)]));
  state.vendorSessionLogs = new Map(snapshot.vendorSessionLogs.map((entry) => [entry.id, cloneValue(entry)]));
  state.vendors = new Map(snapshot.vendors.map((entry) => [entry.id, cloneValue(entry)]));
  state.wallets = new Map(snapshot.wallets.map((entry) => [entry.id, cloneValue(entry)]));
  state.fundingRequests = new Map(snapshot.fundingRequests.map((entry) => [entry.id, cloneValue(entry)]));
  state.purchaseOrders = new Map(snapshot.purchaseOrders.map((entry) => [entry.id, cloneValue(entry)]));
  state.receipts = new Map(snapshot.receipts.map((entry) => [entry.id, cloneValue(entry)]));
  state.commissionRules = new Map(snapshot.commissionRules.map((entry) => [entry.vendorId, cloneValue(entry)]));
  state.ledgerJournals = new Map(snapshot.ledgerJournals.map((entry) => [entry.id, cloneValue(entry)]));
  state.reconciliationExceptions = new Map(
    snapshot.reconciliationExceptions.map((entry) => [entry.id, cloneValue(entry)]),
  );
  state.reconciliationRuns = snapshot.reconciliationRuns.map(cloneValue);
  state.settlementBatches = snapshot.settlementBatches.map(cloneValue);
  state.receiptSequence = Math.max(snapshot.receiptSequence, 100000);
}

function hasDomainFinancialState() {
  const state = getWalletDomainState();
  return (
    state.wallets.size > 0 ||
    state.fundingRequests.size > 0 ||
    state.purchaseOrders.size > 0 ||
    state.receipts.size > 0 ||
    state.ledgerJournals.size > 0 ||
    state.reconciliationExceptions.size > 0
  );
}

export function resetWalletPersistenceMirrorState() {
  walletMirrorState = createMirrorState();
}

function readRecordString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readRecordNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readRecordBoolean(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "boolean" ? value : null;
}

function readRecordObject(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toVendorLifecycleStatus(value: string | null | undefined): VendorProfile["status"] {
  switch (value) {
    case "draft":
    case "pending_review":
    case "approved":
    case "active":
    case "suspended":
    case "rejected":
      return value;
    case "closed":
      return "suspended";
    default:
      return "draft";
  }
}

function toWalletLifecycleStatus(value: string | null | undefined): VendorWallet["status"] {
  switch (value) {
    case "pending":
    case "active":
    case "frozen":
    case "suspended":
      return value;
    default:
      return "pending";
  }
}

function toFundingStatus(value: string | null | undefined): FundingRequestRecord["status"] {
  switch (value) {
    case "initiated":
    case "awaiting_proof":
    case "proof_uploaded":
    case "under_review":
    case "confirmed":
    case "posted":
    case "rejected":
    case "expired":
    case "cancelled":
      return value;
    default:
      return "initiated";
  }
}

function toPurchaseStatus(value: string | null | undefined): PurchaseOrderRecord["status"] {
  switch (value) {
    case "reserved":
    case "processing":
    case "failed":
    case "reversed":
      return value;
    case "successful":
    case "success":
      return "success";
    default:
      return "processing";
  }
}

function toDeliveryMethod(value: string | null | undefined): PurchaseOrderRecord["deliveryMethod"] {
  return value === "remote_send" ? "remote_send" : "token_generate";
}

function toLedgerJournalType(value: string | null | undefined): LedgerJournalRecord["journalType"] {
  switch (value) {
    case "funding":
    case "reserve":
    case "release":
    case "purchase":
    case "commission-accrual":
    case "settlement":
    case "manual-adjustment":
      return value;
    default:
      return "manual-adjustment";
  }
}

function toExceptionSeverity(
  value: string | null | undefined,
): ReconciliationExceptionRecord["severity"] {
  switch (value) {
    case "low":
    case "medium":
    case "high":
    case "critical":
      return value;
    default:
      return "medium";
  }
}

function toExceptionStatus(value: string | null | undefined): ReconciliationExceptionRecord["status"] {
  switch (value) {
    case "open":
    case "assigned":
    case "in_progress":
    case "resolved":
    case "escalated":
      return value;
    default:
      return "open";
  }
}

function toApprovalStatus(value: string | null | undefined): ApprovalRequestRecord["status"] {
  switch (value) {
    case "pending":
    case "approved":
    case "rejected":
    case "cancelled":
      return value;
    default:
      return "pending";
  }
}

async function ensureSite(siteCode: string | null | undefined) {
  const normalizedSiteCode = normalizeSiteCode(siteCode);
  if (!normalizedSiteCode) {
    return null;
  }

  const client = await getWalletDbClient();
  const { data: existing, error: existingError } = await client
    .from("sites")
    .select("code")
    .eq("code", normalizedSiteCode)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to inspect site ${normalizedSiteCode}: ${existingError.message}`);
  }

  if (existing?.code) {
    return existing.code;
  }

  const { error } = await client.from("sites").insert({
    code: normalizedSiteCode,
    name: siteCode,
    region: "Africa/Lagos",
  });

  if (error) {
    throw new Error(`Failed to persist site ${normalizedSiteCode}: ${error.message}`);
  }

  return normalizedSiteCode;
}

async function resolveVendorDbId(vendor: VendorProfile) {
  const client = await getWalletDbClient();
  const siteCode = await ensureSite(vendor.siteCode);
  const vendorCode = normalizeVendorCode(vendor.vendorCode ?? vendor.id);
  if (!vendorCode || !siteCode) {
    return null;
  }

  const { data: existing, error: existingError } = await client
    .from("vendor_organizations")
    .select("id")
    .eq("vendor_code", vendorCode)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to inspect vendor ${vendorCode}: ${existingError.message}`);
  }

  const payload = {
    vendor_code: vendorCode,
    legal_name: vendor.businessName,
    display_name: vendor.businessName,
    status: toVendorDbStatus(vendor.status),
    site_code: siteCode,
    kyc_status: vendor.kycCompleted ? "completed" : "pending",
    risk_rating: inferRiskRating(vendor.riskScore),
    metadata: {
      externalVendorId: vendor.id,
      contactName: vendor.contactName,
      contactEmail: vendor.contactEmail,
      invitedAt: vendor.invitedAt,
      invitedBy: vendor.invitedBy,
      suspensionReason: vendor.suspensionReason,
      bankName: vendor.bankName,
      bankAccountName: vendor.bankAccountName,
      bankAccountNumberMasked: vendor.bankAccountNumber ? `****${vendor.bankAccountNumber.slice(-4)}` : null,
        riskScore: vendor.riskScore,
        failedFundingProofCount: vendor.failedFundingProofCount,
        legalName: vendor.legalName,
        displayName: vendor.displayName,
        contactPhone: vendor.contactPhone,
        alternateContactName: vendor.alternateContactName,
        alternateContactPhone: vendor.alternateContactPhone,
        businessAddress: vendor.businessAddress,
        registrationNumber: vendor.registrationNumber,
        taxId: vendor.taxId,
        bankSortCode: vendor.bankSortCode,
        kycStatus: vendor.kycStatus,
        kycDocumentCount: vendor.kycDocumentCount,
        onboardingSubmittedAt: vendor.onboardingSubmittedAt,
        onboardingSubmittedBy: vendor.onboardingSubmittedBy,
        lastReviewedAt: vendor.lastReviewedAt,
        lastReviewedBy: vendor.lastReviewedBy,
        onboardingNotes: vendor.onboardingNotes,
      },
    created_at: vendor.createdAt,
    updated_at: vendor.updatedAt,
  };

  if (existing?.id) {
    const { error } = await client.from("vendor_organizations").update(payload).eq("id", existing.id);
    if (error) {
      throw new Error(`Failed to update vendor ${vendorCode}: ${error.message}`);
    }
    await upsertVendorPrimaryBankAccount(vendor, existing.id);
    return existing.id;
  }

  const { data, error } = await client
    .from("vendor_organizations")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create vendor ${vendorCode}: ${error.message}`);
  }

  if (data?.id) {
    await upsertVendorPrimaryBankAccount(vendor, data.id);
  }

  return data?.id ?? null;
}

async function ensureWalletAccounts(wallet: VendorWallet, vendorDbId: string) {
  const client = await getWalletDbClient();
  const accountDefinitions = [
    ["vendor_float", "Vendor Float", "liability"],
    ["wallet_reserved", "Wallet Reserved", "liability"],
    ["vendor_commission_payable", "Vendor Commission Payable", "liability"],
    ["vendor_adjustment", "Vendor Adjustment", "expense"],
    ["platform_cash_clearing", "Platform Cash Clearing", "asset"],
    ["platform_energy_sales_clearing", "Platform Energy Sales Clearing", "income"],
    ["platform_commission_expense", "Platform Commission Expense", "expense"],
    ["wallet_adjustment_suspense", "Wallet Adjustment Suspense", "asset"],
  ] as const;

  const siteCode = await ensureSite(wallet.siteCode);
  const rows = accountDefinitions.map(([accountCode, accountName, accountType]) => ({
    wallet_id: wallet.id,
    vendor_id: vendorDbId,
    site_code: siteCode,
    account_code: accountCode,
    account_name: accountName,
    account_type: accountType,
    is_system: true,
  }));

  const { error } = await client
    .from("ledger_accounts")
    .upsert(rows, { onConflict: "wallet_id,account_code" });

  if (error) {
    throw new Error(`Failed to ensure wallet ledger accounts: ${error.message}`);
  }

  const { data, error: readError } = await client
    .from("ledger_accounts")
    .select("id, account_code")
    .eq("wallet_id", wallet.id);

  if (readError) {
    throw new Error(`Failed to read wallet ledger accounts: ${readError.message}`);
  }

  return new Map(
    (data ?? [])
      .map((row) => [String((row as Record<string, unknown>).account_code), String((row as Record<string, unknown>).id)]),
  );
}

async function upsertVendorPrimaryBankAccount(vendor: VendorProfile, vendorDbId: string) {
  if (!vendor.bankName || !vendor.bankAccountName || !vendor.bankAccountNumber) {
    return;
  }

  const client = await getWalletDbClient();
  const payload = {
    vendor_id: vendorDbId,
      bank_name: vendor.bankName,
      account_name: vendor.bankAccountName,
      account_number: vendor.bankAccountNumber,
      is_primary: true,
      metadata: {
        externalVendorId: vendor.id,
        sortCode: vendor.bankSortCode,
      },
    updated_at: vendor.updatedAt,
  };

  const { data: existing, error: existingError } = await client
    .from("vendor_bank_accounts")
    .select("id")
    .eq("vendor_id", vendorDbId)
    .eq("is_primary", true)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to inspect vendor bank account: ${existingError.message}`);
  }

  if (existing?.id) {
    const { error } = await client.from("vendor_bank_accounts").update(payload).eq("id", existing.id);
    if (error) {
      throw new Error(`Failed to update vendor bank account: ${error.message}`);
    }
    return;
  }

  const { error } = await client.from("vendor_bank_accounts").insert({
    ...payload,
    created_at: vendor.createdAt,
  });

  if (error) {
    throw new Error(`Failed to create vendor bank account: ${error.message}`);
  }
}

async function upsertVendorUser(vendor: VendorProfile, vendorDbId: string) {
  const invitation = getWalletDomainState().invitations.get(vendor.id);
  if (!invitation?.authUserId || !isUuid(invitation.authUserId)) {
    return;
  }

  const siteCode = await ensureSite(vendor.siteCode);
  if (!siteCode) {
    return;
  }

  const client = await getWalletDbClient();
  const payload = {
    vendor_id: vendorDbId,
    auth_user_id: invitation.authUserId,
    app_role: invitation.role,
    role: invitation.role,
    site_code: siteCode,
    invited_by: nullableUuid(invitation.issuedBy),
    created_by: nullableUuid(invitation.issuedBy),
    invited_at: invitation.issuedAt,
    status: invitation.forcePasswordChange ? "pending_password_reset" : "active",
    updated_at: vendor.updatedAt,
  };

  const { data: existing, error: existingError } = await client
    .from("vendor_users")
    .select("id")
    .eq("auth_user_id", invitation.authUserId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to inspect vendor user: ${existingError.message}`);
  }

  if (existing?.id) {
    const { error } = await client.from("vendor_users").update(payload).eq("id", existing.id);
    if (error) {
      throw new Error(`Failed to update vendor user: ${error.message}`);
    }
    return;
  }

  const { error } = await client.from("vendor_users").insert({
    ...payload,
    created_at: invitation.issuedAt,
  });

  if (error) {
    throw new Error(`Failed to create vendor user: ${error.message}`);
  }
}

function fireAndForget(label: string, promise: Promise<unknown>) {
  void promise.catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Could not find the table")) {
      return;
    }

    console.error(`[wallet-persistence] ${label} failed:`, error instanceof Error ? error.message : error);
  });
}

export function persistVendorInvitation(invitation: VendorInvitation) {
  upsertMirrorMapRecord(walletMirrorState.invitations, invitation.vendorId, invitation);
  if (!isSupabaseDbEnabled()) {
    return;
  }

  void invitation;
}

export function persistApprovalRequest(request: ApprovalRequestRecord) {
  upsertMirrorMapRecord(walletMirrorState.approvalRequests, request.id, request);
  if (!isSupabaseDbEnabled()) {
    return;
  }

  fireAndForget(
    "approval request",
    (async () => {
      if (!(await isWalletSchemaReady())) {
        return;
      }

      const vendor = getWalletDomainState().vendors.get(request.vendorId);
      const siteCode = await ensureSite(request.siteCode);
      if (!vendor || !siteCode) {
        return;
      }

      const vendorDbId = await resolveVendorDbId(vendor);
      if (!vendorDbId) {
        return;
      }

      const metadata = request.metadata ?? {};
      const targetType =
        readRecordString(metadata, "targetType") ??
        (request.requestType === "vendor_onboarding" ? "vendor_organization" : "wallet_operation");
      const targetId =
        targetType === "vendor_organization"
          ? vendorDbId
          : (readRecordString(metadata, "targetId") ??
            readRecordString(metadata, "walletId") ??
            readRecordString(metadata, "purchaseOrderId") ??
            request.vendorId);

      const client = await getWalletDbClient();
      const { error } = await client.from("approval_requests").upsert(
        {
          id: request.id,
          site_code: siteCode,
          action_type: request.requestType,
          target_type: targetType,
          target_id: targetId,
          status: request.status,
          maker_id: nullableUuid(request.submittedBy),
          checker_id: nullableUuid(request.checkerId),
          payload: {
            ...request.metadata,
            externalVendorId: request.vendorId,
            summary: request.summary,
            notes: request.notes,
          },
          maker_at: request.submittedAt,
          checker_at: request.checkerAt,
          created_at: request.submittedAt,
          updated_at: request.lastUpdatedAt,
        },
        { onConflict: "id" },
      );

      if (error) {
        throw new Error(`Failed to persist approval request: ${error.message}`);
      }
    })(),
  );
}

export function persistVendorProfile(vendor: VendorProfile) {
  upsertMirrorMapRecord(walletMirrorState.vendors, vendor.id, vendor);
  if (!isSupabaseDbEnabled()) {
    return;
  }

  fireAndForget(
    "vendor profile",
    (async () => {
      if (!(await isWalletSchemaReady())) {
        return;
      }

      const vendorDbId = await resolveVendorDbId(vendor);
      if (!vendorDbId) {
        return;
      }

      await upsertVendorUser(vendor, vendorDbId);

      if (vendor.walletId) {
        const wallet = getWalletDomainState().wallets.get(vendor.walletId);
        if (wallet) {
          persistWallet(wallet);
        }
      }
    })(),
  );
}

export function persistCommissionRule(vendorId: string, rule: CommissionRuleRecord) {
  void vendorId;
  upsertMirrorMapRecord(walletMirrorState.commissionRules, rule.vendorId, rule);
  if (!isSupabaseDbEnabled()) {
    return;
  }

  fireAndForget(
    "commission rule",
    (async () => {
      if (!(await isWalletSchemaReady())) {
        return;
      }

      const vendor = getWalletDomainState().vendors.get(vendorId);
      if (!vendor) {
        return;
      }

      const vendorDbId = await resolveVendorDbId(vendor);
      const siteCode = await ensureSite(vendor.siteCode);
      if (!vendorDbId || !siteCode) {
        return;
      }

      const client = await getWalletDbClient();
      const { error } = await client.from("vendor_commission_rules").upsert(
        {
          vendor_id: vendorDbId,
          site_code: siteCode,
          commission_rate: roundMoney(rule.rate),
          settlement_mode: "wallet_credit",
          is_active: true,
          metadata: {
            externalVendorId: vendor.id,
            overrideSource: rule.overrideSource,
          },
          created_at: rule.createdAt,
          updated_at: rule.updatedAt,
        },
        { onConflict: "vendor_id" },
      );

      if (error) {
        throw new Error(`Failed to persist commission rule: ${error.message}`);
      }
    })(),
  );
}

export function persistWallet(wallet: VendorWallet) {
  upsertMirrorMapRecord(walletMirrorState.wallets, wallet.id, wallet);
  if (!isSupabaseDbEnabled()) {
    return;
  }

  fireAndForget(
    "wallet",
    (async () => {
      if (!(await isWalletSchemaReady())) {
        return;
      }

      const vendor = getWalletDomainState().vendors.get(wallet.vendorId);
      if (!vendor) {
        return;
      }

      const vendorDbId = await resolveVendorDbId(vendor);
      const siteCode = await ensureSite(wallet.siteCode);
      if (!vendorDbId || !siteCode) {
        return;
      }

      const client = await getWalletDbClient();
      const { error } = await client.from("vendor_wallets").upsert(
        {
          id: wallet.id,
          vendor_id: vendorDbId,
          wallet_number: `WLT-${wallet.id.slice(0, 8).toUpperCase()}`,
          site_code: siteCode,
          currency_code: wallet.currency,
          status: wallet.status,
          allow_credit: wallet.creditLimit > 0,
          credit_limit: roundMoney(wallet.creditLimit),
          frozen_reason: wallet.frozenReason,
          metadata: {
            externalVendorId: wallet.vendorId,
          },
          created_at: wallet.createdAt,
          updated_at: wallet.updatedAt,
        },
        { onConflict: "id" },
      );

      if (error) {
        throw new Error(`Failed to persist vendor wallet: ${error.message}`);
      }

      const { error: limitsError } = await client.from("vendor_wallet_limits").upsert(
        {
          wallet_id: wallet.id,
          daily_purchase_limit: 0,
          per_transaction_limit: 0,
          max_pending_reservations: 5,
          max_failed_funding_proofs: 3,
          rapid_purchase_threshold: 10,
        },
        { onConflict: "wallet_id" },
      );

      if (limitsError) {
        throw new Error(`Failed to persist wallet limits: ${limitsError.message}`);
      }

      const { error: snapshotError } = await client.from("wallet_balance_snapshots").upsert(
        {
          wallet_id: wallet.id,
          vendor_id: vendorDbId,
          site_code: siteCode,
          available_balance: roundMoney(wallet.availableBalance),
          reserved_balance: roundMoney(wallet.reservedBalance),
          total_funded: roundMoney(wallet.totalFunded),
          total_purchased: roundMoney(wallet.totalPurchased),
          total_commission_accrued: roundMoney(wallet.totalCommissionAccrued),
          total_commission_settled: roundMoney(wallet.totalCommissionSettled),
          updated_at: wallet.updatedAt,
        },
        { onConflict: "wallet_id" },
      );

      if (snapshotError) {
        throw new Error(`Failed to persist wallet snapshot: ${snapshotError.message}`);
      }

      await ensureWalletAccounts(wallet, vendorDbId);
    })(),
  );
}

export function persistFundingRequest(request: FundingRequestRecord) {
  upsertMirrorMapRecord(walletMirrorState.fundingRequests, request.id, request);
  if (!isSupabaseDbEnabled()) {
    return;
  }

  fireAndForget(
    "funding request",
    (async () => {
      if (!(await isWalletSchemaReady())) {
        return;
      }

      const vendor = getWalletDomainState().vendors.get(request.vendorId);
      if (!vendor) {
        return;
      }

      const vendorDbId = await resolveVendorDbId(vendor);
      const siteCode = await ensureSite(request.siteCode);
      if (!vendorDbId || !siteCode) {
        return;
      }

      const wallet = getWalletDomainState().wallets.get(request.walletId);
      if (wallet) {
        persistWallet(wallet);
      }

      const client = await getWalletDbClient();
      const { error } = await client.from("wallet_funding_requests").upsert(
        {
          id: request.id,
          vendor_id: vendorDbId,
          wallet_id: request.walletId,
          site_code: siteCode,
          amount: roundMoney(request.amount),
          channel: request.channel,
          reference: request.reference,
          status: toFundingDbStatus(request.status),
          notes: request.notes,
          external_bank_ref: request.externalBankRef,
          reviewer_note: request.reviewerNote,
          reviewed_at: request.reviewedAt,
          approved_by: nullableUuid(request.approvedBy),
            posted_at: request.postedAt,
            metadata: {
              idempotencyKey: request.idempotencyKey,
              proofFileName: request.proofFileName,
              proofDocumentId: request.proofDocumentId,
              proofUploadedAt: request.proofUploadedAt,
              expiresAt: request.expiresAt,
              externalVendorId: request.vendorId,
            },
          created_at: request.createdAt,
          updated_at: request.updatedAt,
        },
        { onConflict: "id" },
      );

      if (error) {
        throw new Error(`Failed to persist funding request: ${error.message}`);
      }
    })(),
  );
}

export function persistLedgerJournal(journal: LedgerJournalRecord) {
  upsertMirrorMapRecord(walletMirrorState.ledgerJournals, journal.id, journal);
  if (!isSupabaseDbEnabled()) {
    return;
  }

  fireAndForget(
    "ledger journal",
    (async () => {
      if (!(await isWalletSchemaReady())) {
        return;
      }

      const vendor = getWalletDomainState().vendors.get(journal.vendorId);
      const wallet = getWalletDomainState().wallets.get(journal.walletId);
      if (!vendor || !wallet) {
        return;
      }

      const vendorDbId = await resolveVendorDbId(vendor);
      const siteCode = await ensureSite(journal.siteCode);
      if (!vendorDbId || !siteCode) {
        return;
      }

      await persistWallet(wallet);
      const accountMap = await ensureWalletAccounts(wallet, vendorDbId);
      const client = await getWalletDbClient();

      const { error } = await client.from("ledger_journals").upsert(
        {
          id: journal.id,
          wallet_id: journal.walletId,
          vendor_id: vendorDbId,
          site_code: siteCode,
          journal_type: journal.journalType,
          source_type: "wallet_service",
          source_id: String(journal.metadata.purchaseOrderId ?? journal.metadata.fundingRequestId ?? journal.id),
          business_date: journal.createdAt.slice(0, 10),
          status: journal.status,
          reference: journal.reference,
          posted_by: nullableUuid(journal.postedBy),
          amount: roundMoney(journal.amount),
          metadata: {
            ...journal.metadata,
            externalVendorId: journal.vendorId,
          },
          posted_at: journal.createdAt,
          created_at: journal.createdAt,
        },
        { onConflict: "id" },
      );

      if (error) {
        throw new Error(`Failed to persist ledger journal: ${error.message}`);
      }

      const entryRows = journal.entries.reduce<Array<Record<string, unknown>>>((rows, entry) => {
        const accountId = accountMap.get(entry.accountCode);
        if (!accountId) {
          return rows;
        }

        rows.push({
          id: entry.id,
          journal_id: journal.id,
          account_id: accountId,
          wallet_id: journal.walletId,
          vendor_id: vendorDbId,
          site_code: siteCode,
          entry_side: entry.direction,
          amount: roundMoney(entry.amount),
          currency_code: wallet.currency,
          reference_type: journal.journalType,
          reference_id: entry.reference,
          metadata: {
            ...entry.metadata,
            description: entry.description,
            externalVendorId: entry.vendorId,
          },
          created_at: entry.createdAt,
        });

        return rows;
      }, []);

      if (entryRows.length === 0) {
        return;
      }

      const { error: entryError } = await client
        .from("ledger_entries")
        .upsert(entryRows, { onConflict: "id" });

      if (entryError) {
        throw new Error(`Failed to persist ledger entries: ${entryError.message}`);
      }
    })(),
  );
}

export function persistPurchaseOrder(order: PurchaseOrderRecord) {
  upsertMirrorMapRecord(walletMirrorState.purchaseOrders, order.id, order);
  if (!isSupabaseDbEnabled()) {
    return;
  }

  fireAndForget(
    "purchase order",
    (async () => {
      if (!(await isWalletSchemaReady())) {
        return;
      }

      const vendor = getWalletDomainState().vendors.get(order.vendorId);
      const wallet = getWalletDomainState().wallets.get(order.walletId);
      if (!vendor || !wallet) {
        return;
      }

      const vendorDbId = await resolveVendorDbId(vendor);
      const siteCode = await ensureSite(order.siteCode);
      if (!vendorDbId || !siteCode) {
        return;
      }

      persistWallet(wallet);
      const client = await getWalletDbClient();
      const commissionAmount =
        typeof order.metadata.commissionAmount === "number"
          ? roundMoney(order.metadata.commissionAmount)
          : 0;
      const { error } = await client.from("wallet_purchase_orders").upsert(
        {
          id: order.id,
          vendor_id: vendorDbId,
          wallet_id: order.walletId,
          site_code: siteCode,
          meter_sn: order.meterSn,
          customer_ref: order.customerRef,
          amount: roundMoney(order.amount),
          fee_amount: 0,
          commission_amount: commissionAmount,
          net_debit_amount: roundMoney(order.amount),
          status: toPurchaseDbStatus(order.status),
          idempotency_key: order.idempotencyKey,
          delivery_method: order.deliveryMethod,
          delivery_destination: order.deliveryDestination,
          token_value: order.tokenValue,
          upstream_request_ref: order.idempotencyKey,
          upstream_transaction_id: order.remoteSendRef,
          remote_send_ref: order.remoteSendRef,
          receipt_ref: order.receiptRef,
          request_payload: {
            meterSn: order.meterSn,
            customerRef: order.customerRef,
            deliveryMethod: order.deliveryMethod,
          },
          response_payload: {
            upstreamStatus: order.upstreamStatus,
            failureCode: order.failureCode,
            failureReason: order.failureReason,
            commissionAmount,
            commissionRate: order.metadata.commissionRate ?? 0,
            receiptNumber: order.metadata.receiptNumber ?? null,
          },
          requested_by: nullableUuid(order.actorUserId),
          reserved_journal_id: order.reservedJournalId,
          final_journal_id: order.finalJournalId,
          released_journal_id: order.releasedJournalId,
          reserved_at: order.reservedAt,
          settled_at: order.settledAt,
          created_at: order.createdAt,
          updated_at: order.updatedAt,
        },
        { onConflict: "id" },
      );

      if (error) {
        throw new Error(`Failed to persist purchase order: ${error.message}`);
      }
    })(),
  );
}

export function persistReceipt(receipt: WalletReceiptRecord) {
  upsertMirrorMapRecord(walletMirrorState.receipts, receipt.id, receipt);
  updateMirrorReceiptSequence(receipt.receiptNumber);
  if (!isSupabaseDbEnabled()) {
    return;
  }

  fireAndForget(
    "wallet receipt",
    (async () => {
      if (!(await isWalletSchemaReady())) {
        return;
      }

      const vendor = getWalletDomainState().vendors.get(receipt.vendorId);
      if (!vendor) {
        return;
      }

      const vendorDbId = await resolveVendorDbId(vendor);
      const siteCode = await ensureSite(receipt.siteCode);
      if (!vendorDbId || !siteCode) {
        return;
      }

      const client = await getWalletDbClient();
      const { error } = await client.from("wallet_receipts").upsert(
        {
          id: receipt.id,
          purchase_order_id: receipt.purchaseOrderId,
          vendor_id: vendorDbId,
          site_code: siteCode,
          delivery_method: receipt.deliveryMethod,
          meter_sn: receipt.meterSn,
          customer_ref: receipt.customerRef,
          amount: roundMoney(receipt.amount),
          token_value: receipt.tokenValue,
          remote_send_ref: receipt.remoteSendRef,
          issued_at: receipt.issuedAt,
          receipt_number: receipt.receiptNumber,
          issued_by: nullableUuid(receipt.issuedBy),
          created_at: receipt.issuedAt,
        },
        { onConflict: "id" },
      );

      if (error) {
        throw new Error(`Failed to persist wallet receipt: ${error.message}`);
      }
    })(),
  );
}

export function persistReconciliationException(exception: ReconciliationExceptionRecord) {
  upsertMirrorMapRecord(walletMirrorState.reconciliationExceptions, exception.id, exception);
  if (!isSupabaseDbEnabled()) {
    return;
  }

  fireAndForget(
    "wallet reconciliation exception",
    (async () => {
      if (!(await isWalletSchemaReady())) {
        return;
      }

      const vendor = exception.vendorId ? getWalletDomainState().vendors.get(exception.vendorId) : null;
      const vendorDbId = vendor ? await resolveVendorDbId(vendor) : null;
      const siteCode = await ensureSite(exception.siteCode);
      if (!siteCode) {
        return;
      }

      const client = await getWalletDbClient();
      const { error } = await client.from("wallet_exceptions").upsert(
        {
          id: exception.id,
          exception_type: exception.type,
          severity: exception.severity,
          status: exception.status,
          site_code: siteCode,
          vendor_id: vendorDbId,
          wallet_id: exception.walletId,
          purchase_order_id: exception.purchaseOrderId,
          funding_request_id: exception.fundingRequestId,
          summary: exception.summary,
          details: {
            ...exception.details,
            escalatedAt: exception.escalatedAt,
            escalationReason: exception.escalationReason,
            resolutionCode: exception.resolutionCode,
          },
          due_at: exception.dueAt,
          assignee_user_id: nullableUuid(exception.assignee),
          resolution_notes: exception.resolutionNotes,
          resolved_at: exception.resolvedAt,
          resolved_by: nullableUuid(exception.resolvedBy),
          created_at: exception.detectedAt,
          updated_at: exception.resolvedAt ?? exception.escalatedAt ?? exception.detectedAt,
        },
        { onConflict: "id" },
      );

      if (error) {
        throw new Error(`Failed to persist wallet exception: ${error.message}`);
      }
    })(),
  );
}

export function persistReconciliationRun(run: ReconciliationRunRecord) {
  replaceMirrorArrayRecord(walletMirrorState.reconciliationRuns, run);
  if (!isSupabaseDbEnabled()) {
    return;
  }

  fireAndForget(
    "wallet reconciliation run",
    (async () => {
      if (!(await isWalletSchemaReady())) {
        return;
      }

      const client = await getWalletDbClient();
      const { error } = await client.from("wallet_reconciliation_runs").upsert(
        {
          id: run.id,
          business_date: run.businessDate,
          status: run.status,
          dry_run: run.dryRun,
          triggered_by: nullableUuid(run.triggeredBy),
          started_at: run.startedAt,
          completed_at: run.completedAt,
          exception_count: run.exceptionCount,
          summary: {
            stages: run.stageSummaries,
            reportLockedAt: run.reportLockedAt,
          },
        },
        { onConflict: "id" },
      );

      if (error) {
        throw new Error(`Failed to persist reconciliation run: ${error.message}`);
      }
    })(),
  );
}

export function persistSettlementBatch(batch: SettlementBatchRecord) {
  replaceMirrorArrayRecord(walletMirrorState.settlementBatches, batch);
  if (!isSupabaseDbEnabled()) {
    return;
  }

  fireAndForget(
    "wallet settlement batch",
    (async () => {
      if (!(await isWalletSchemaReady())) {
        return;
      }

      const siteBreakdown = (batch.siteBreakdown ?? []).filter((entry) => normalizeSiteCode(entry.siteCode));
      if (siteBreakdown.length === 0) {
        return;
      }

      const client = await getWalletDbClient();
      const rows: Array<Record<string, unknown>> = [];
      for (const entry of siteBreakdown) {
        const siteCode = await ensureSite(entry.siteCode);
        if (!siteCode) {
          continue;
        }

        rows.push({
          site_code: siteCode,
          business_date: batch.businessDate,
          status: batch.status,
          total_commission_credits: roundMoney(entry.totalCommissionCredits),
          item_count: entry.itemCount,
          created_by: nullableUuid(batch.createdBy),
          posted_by: batch.status === "posted" ? nullableUuid(batch.createdBy) : null,
          metadata: {
            externalBatchId: batch.id,
            siteBreakdownCount: siteBreakdown.length,
          },
          created_at: batch.createdAt,
          posted_at: batch.postedAt,
        });
      }

      if (rows.length === 0) {
        return;
      }

      const { error } = await client
        .from("wallet_settlement_batches")
        .upsert(rows, { onConflict: "site_code,business_date" });

      if (error) {
        throw new Error(`Failed to persist settlement batch: ${error.message}`);
      }
    })(),
  );
}

async function readSupabaseSnapshot(): Promise<WalletPersistenceSnapshot | null> {
  if (!(await isWalletSchemaReady())) {
    return null;
  }

  const client = await getWalletDbClient();
  const [
    vendorResponse,
    vendorUserResponse,
    bankResponse,
    approvalResponse,
    walletResponse,
    snapshotResponse,
    ruleResponse,
    fundingResponse,
    purchaseResponse,
    receiptResponse,
    journalResponse,
    entryResponse,
    accountResponse,
    exceptionResponse,
    runResponse,
    settlementResponse,
  ] = await Promise.all([
    client.from("vendor_organizations").select("*"),
    client.from("vendor_users").select("*"),
    client.from("vendor_bank_accounts").select("*").eq("is_primary", true),
    client.from("approval_requests").select("*"),
    client.from("vendor_wallets").select("*"),
    client.from("wallet_balance_snapshots").select("*"),
    client.from("vendor_commission_rules").select("*"),
    client.from("wallet_funding_requests").select("*"),
    client.from("wallet_purchase_orders").select("*"),
    client.from("wallet_receipts").select("*"),
    client.from("ledger_journals").select("*"),
    client.from("ledger_entries").select("*"),
    client.from("ledger_accounts").select("*"),
    client.from("wallet_exceptions").select("*"),
    client.from("wallet_reconciliation_runs").select("*"),
    client.from("wallet_settlement_batches").select("*"),
  ]);

  const responses = [
    vendorResponse,
    vendorUserResponse,
    bankResponse,
    approvalResponse,
    walletResponse,
    snapshotResponse,
    ruleResponse,
    fundingResponse,
    purchaseResponse,
    receiptResponse,
    journalResponse,
    entryResponse,
    accountResponse,
    exceptionResponse,
    runResponse,
    settlementResponse,
  ];

  for (const response of responses) {
    if (response.error) {
      throw new Error(`Failed to load wallet read model: ${response.error.message}`);
    }
  }

  const vendorRows = (vendorResponse.data ?? []) as Array<Record<string, unknown>>;
  const vendorUserRows = (vendorUserResponse.data ?? []) as Array<Record<string, unknown>>;
  const bankRows = (bankResponse.data ?? []) as Array<Record<string, unknown>>;
  const approvalRows = (approvalResponse.data ?? []) as Array<Record<string, unknown>>;
  const walletRows = (walletResponse.data ?? []) as Array<Record<string, unknown>>;
  const balanceRows = (snapshotResponse.data ?? []) as Array<Record<string, unknown>>;
  const ruleRows = (ruleResponse.data ?? []) as Array<Record<string, unknown>>;
  const fundingRows = (fundingResponse.data ?? []) as Array<Record<string, unknown>>;
  const purchaseRows = (purchaseResponse.data ?? []) as Array<Record<string, unknown>>;
  const receiptRows = (receiptResponse.data ?? []) as Array<Record<string, unknown>>;
  const journalRows = (journalResponse.data ?? []) as Array<Record<string, unknown>>;
  const entryRows = (entryResponse.data ?? []) as Array<Record<string, unknown>>;
  const accountRows = (accountResponse.data ?? []) as Array<Record<string, unknown>>;
  const exceptionRows = (exceptionResponse.data ?? []) as Array<Record<string, unknown>>;
  const runRows = (runResponse.data ?? []) as Array<Record<string, unknown>>;
  const settlementRows = (settlementResponse.data ?? []) as Array<Record<string, unknown>>;

  const vendorUsersByVendorDbId = new Map<string, Record<string, unknown>>();
  for (const row of vendorUserRows) {
    const vendorDbId = readRecordString(row, "vendor_id");
    if (vendorDbId && !vendorUsersByVendorDbId.has(vendorDbId)) {
      vendorUsersByVendorDbId.set(vendorDbId, row);
    }
  }

  const bankByVendorDbId = new Map<string, Record<string, unknown>>();
  for (const row of bankRows) {
    const vendorDbId = readRecordString(row, "vendor_id");
    if (vendorDbId && !bankByVendorDbId.has(vendorDbId)) {
      bankByVendorDbId.set(vendorDbId, row);
    }
  }

  const vendors: VendorProfile[] = vendorRows.map((row) => {
    const metadata = readRecordObject(row, "metadata");
    const vendorDbId = readRecordString(row, "id") ?? "";
    const vendorUser = vendorUsersByVendorDbId.get(vendorDbId) ?? {};
    const bank = bankByVendorDbId.get(vendorDbId) ?? {};
    const externalVendorId =
      readRecordString(metadata, "externalVendorId") ??
      normalizeCode(readRecordString(row, "vendor_code") ?? vendorDbId);
    const businessName =
      readRecordString(metadata, "businessName") ??
      readRecordString(metadata, "displayName") ??
      readRecordString(row, "display_name") ??
      readRecordString(row, "legal_name") ??
      externalVendorId;

    return {
      id: externalVendorId,
      vendorCode: normalizeCode(readRecordString(row, "vendor_code") ?? externalVendorId),
      legalName: readRecordString(metadata, "legalName") ?? readRecordString(row, "legal_name"),
      displayName: readRecordString(metadata, "displayName") ?? readRecordString(row, "display_name"),
      businessName,
      contactName: readRecordString(metadata, "contactName") ?? businessName,
      contactEmail:
        readRecordString(metadata, "contactEmail") ?? `${externalVendorId.toLowerCase()}@vendor.local`,
      contactPhone: readRecordString(metadata, "contactPhone"),
      alternateContactName: readRecordString(metadata, "alternateContactName"),
      alternateContactPhone: readRecordString(metadata, "alternateContactPhone"),
      businessAddress: readRecordString(metadata, "businessAddress"),
      registrationNumber: readRecordString(metadata, "registrationNumber"),
      taxId: readRecordString(metadata, "taxId"),
      siteCode: normalizeCode(readRecordString(row, "site_code") ?? "SITE_UNASSIGNED"),
      status: toVendorLifecycleStatus(readRecordString(row, "status")),
      invitedAt: readRecordString(metadata, "invitedAt") ?? readRecordString(vendorUser, "invited_at"),
      invitedBy: readRecordString(metadata, "invitedBy") ?? readRecordString(vendorUser, "invited_by"),
      approvedAt: readRecordString(metadata, "approvedAt"),
      approvedBy: readRecordString(metadata, "approvedBy"),
      suspendedAt: readRecordString(metadata, "suspendedAt"),
      suspendedBy: readRecordString(metadata, "suspendedBy"),
      suspensionReason: readRecordString(metadata, "suspensionReason"),
      bankName: readRecordString(bank, "bank_name") ?? readRecordString(metadata, "bankName"),
      bankAccountName:
        readRecordString(bank, "account_name") ?? readRecordString(metadata, "bankAccountName"),
      bankAccountNumber:
        readRecordString(bank, "account_number") ?? readRecordString(metadata, "bankAccountNumberMasked"),
      bankSortCode:
        readRecordString(readRecordObject(bank, "metadata"), "sortCode") ??
        readRecordString(metadata, "bankSortCode"),
      walletId: null,
      riskScore: roundMoney(readRecordNumber(metadata, "riskScore") ?? 0),
      failedFundingProofCount: Math.max(0, readRecordNumber(metadata, "failedFundingProofCount") ?? 0),
      lastFundingProofFailureAt: readRecordString(metadata, "lastFundingProofFailureAt"),
      kycCompleted:
        readRecordString(row, "kyc_status") === "completed" ||
        readRecordBoolean(metadata, "kycCompleted") === true,
      kycStatus:
        (readRecordString(metadata, "kycStatus") as VendorProfile["kycStatus"] | null) ??
        (readRecordString(row, "kyc_status") === "completed" ? "approved" : "not_started"),
      kycDocumentCount: Math.max(0, readRecordNumber(metadata, "kycDocumentCount") ?? 0),
      onboardingSubmittedAt: readRecordString(metadata, "onboardingSubmittedAt"),
      onboardingSubmittedBy: readRecordString(metadata, "onboardingSubmittedBy"),
      lastReviewedAt: readRecordString(metadata, "lastReviewedAt"),
      lastReviewedBy: readRecordString(metadata, "lastReviewedBy"),
      onboardingNotes: readRecordString(metadata, "onboardingNotes"),
      createdAt: readRecordString(row, "created_at") ?? new Date().toISOString(),
      updatedAt: readRecordString(row, "updated_at") ?? new Date().toISOString(),
    };
  });

  const vendorByDbId = new Map<string, VendorProfile>();
  const vendorById = new Map<string, VendorProfile>();
  for (let index = 0; index < vendorRows.length; index += 1) {
    const vendorDbId = readRecordString(vendorRows[index] ?? {}, "id");
    const vendor = vendors[index];
    if (vendorDbId && vendor) {
      vendorByDbId.set(vendorDbId, vendor);
    }
    if (vendor) {
      vendorById.set(vendor.id, vendor);
    }
  }

  const balanceByWalletId = new Map<string, Record<string, unknown>>();
  for (const row of balanceRows) {
    const walletId = readRecordString(row, "wallet_id");
    if (walletId) {
      balanceByWalletId.set(walletId, row);
    }
  }

  const wallets: VendorWallet[] = walletRows.map((row) => {
    const walletId = readRecordString(row, "id") ?? "wallet-missing";
    const balance = balanceByWalletId.get(walletId) ?? {};
    const vendor = vendorByDbId.get(readRecordString(row, "vendor_id") ?? "");
    const wallet: VendorWallet = {
      id: walletId,
      vendorId: vendor?.id ?? normalizeCode(readRecordString(row, "vendor_id") ?? walletId),
      siteCode: normalizeCode(readRecordString(row, "site_code") ?? vendor?.siteCode ?? "SITE_UNASSIGNED"),
      currency: "NGN",
      status: toWalletLifecycleStatus(readRecordString(row, "status")),
      availableBalance: roundMoney(readRecordNumber(balance, "available_balance") ?? 0),
      reservedBalance: roundMoney(readRecordNumber(balance, "reserved_balance") ?? 0),
      totalFunded: roundMoney(readRecordNumber(balance, "total_funded") ?? 0),
      totalPurchased: roundMoney(readRecordNumber(balance, "total_purchased") ?? 0),
      totalCommissionAccrued: roundMoney(readRecordNumber(balance, "total_commission_accrued") ?? 0),
      totalCommissionSettled: roundMoney(readRecordNumber(balance, "total_commission_settled") ?? 0),
      creditLimit: roundMoney(readRecordNumber(row, "credit_limit") ?? 0),
      frozenReason: readRecordString(row, "frozen_reason"),
      createdAt: readRecordString(row, "created_at") ?? new Date().toISOString(),
      updatedAt: readRecordString(row, "updated_at") ?? new Date().toISOString(),
    };
    if (vendor) {
      vendor.walletId = wallet.id;
    }
    return wallet;
  });

  const invitations = vendorUserRows.reduce<VendorInvitation[]>((rows, row) => {
    const vendor = vendorByDbId.get(readRecordString(row, "vendor_id") ?? "");
    if (!vendor) {
      return rows;
    }

    rows.push({
      id: `${vendor.id}:invite`,
      vendorId: vendor.id,
      username: readRecordString(row, "auth_user_id") ?? vendor.contactEmail,
      loginIdentifier: vendor.contactEmail,
      role: readRecordString(row, "role") === "vendor_manager" ? "vendor_manager" : "vendor_user",
      authUserId: readRecordString(row, "auth_user_id"),
      temporaryPasswordIssued: true,
      temporaryPasswordExpiresAt: null,
      forcePasswordChange: readRecordString(row, "status") === "pending_password_reset",
      siteCode: vendor.siteCode,
      issuedBy: readRecordString(row, "invited_by") ?? "system",
      issuedAt: readRecordString(row, "invited_at") ?? vendor.createdAt,
    });

    return rows;
  }, []);

  const approvalRequests: ApprovalRequestRecord[] = approvalRows
    .map((row) => {
      const payload = readRecordObject(row, "payload");
      const vendor =
        vendorByDbId.get(readRecordString(row, "target_id") ?? "") ??
        (readRecordString(payload, "externalVendorId")
          ? vendorById.get(normalizeCode(readRecordString(payload, "externalVendorId") ?? ""))
          : undefined);
      if (!vendor) {
        return null;
      }
      const requestTypeRaw = readRecordString(row, "action_type");
      return {
        id: readRecordString(row, "id") ?? `${vendor.id}:approval`,
        requestType:
          requestTypeRaw === "purchase_reversal" ||
          requestTypeRaw === "wallet_manual_credit" ||
          requestTypeRaw === "wallet_credit_limit_change" ||
          requestTypeRaw === "wallet_freeze" ||
          requestTypeRaw === "wallet_unfreeze"
            ? requestTypeRaw
            : "vendor_onboarding",
        vendorId: vendor.id,
        siteCode: normalizeCode(readRecordString(row, "site_code") ?? vendor.siteCode),
        status: toApprovalStatus(readRecordString(row, "status")),
        summary: readRecordString(payload, "summary") ?? `${vendor.businessName} onboarding review`,
        submittedAt: readRecordString(row, "maker_at") ?? vendor.createdAt,
        submittedBy: readRecordString(row, "maker_id") ?? vendor.contactEmail,
        lastUpdatedAt: readRecordString(row, "updated_at") ?? vendor.updatedAt,
        checkerId: readRecordString(row, "checker_id"),
        checkerAt: readRecordString(row, "checker_at"),
        notes: readRecordString(payload, "notes"),
        metadata: payload,
      } satisfies ApprovalRequestRecord;
    })
    .filter((entry): entry is ApprovalRequestRecord => entry !== null);

  const commissionRules: CommissionRuleRecord[] = ruleRows
    .map((row) => {
      const vendor = vendorByDbId.get(readRecordString(row, "vendor_id") ?? "");
      if (!vendor) {
        return null;
      }
      const metadata = readRecordObject(row, "metadata");
      return {
        vendorId: vendor.id,
        rate: roundMoney(readRecordNumber(row, "commission_rate") ?? 0),
        overrideSource:
          readRecordString(metadata, "overrideSource") === "vendor_override"
            ? "vendor_override"
            : "default",
        createdAt: readRecordString(row, "created_at") ?? vendor.createdAt,
        updatedAt: readRecordString(row, "updated_at") ?? vendor.updatedAt,
      } satisfies CommissionRuleRecord;
    })
    .filter((entry): entry is CommissionRuleRecord => entry !== null);

  const fundingRequests: FundingRequestRecord[] = fundingRows
    .map((row) => {
      const vendor = vendorByDbId.get(readRecordString(row, "vendor_id") ?? "");
      if (!vendor) {
        return null;
      }
      const metadata = readRecordObject(row, "metadata");
      return {
        id: readRecordString(row, "id") ?? "funding-missing",
        vendorId: vendor.id,
        walletId: readRecordString(row, "wallet_id") ?? "",
        siteCode: normalizeCode(readRecordString(row, "site_code") ?? vendor.siteCode),
        idempotencyKey: readRecordString(metadata, "idempotencyKey") ?? readRecordString(row, "reference") ?? "",
        amount: roundMoney(readRecordNumber(row, "amount") ?? 0),
        channel: ((readRecordString(row, "channel") ?? "bank_transfer") as FundingRequestRecord["channel"]),
        reference: readRecordString(row, "reference") ?? "",
        externalBankRef: readRecordString(row, "external_bank_ref"),
        proofFileName: readRecordString(metadata, "proofFileName"),
        proofDocumentId:
          readRecordString(row, "proof_document_id") ?? readRecordString(metadata, "proofDocumentId"),
        proofUploadedAt: readRecordString(metadata, "proofUploadedAt"),
        expiresAt: readRecordString(metadata, "expiresAt"),
        status: toFundingStatus(readRecordString(row, "status")),
        notes: readRecordString(row, "notes"),
        createdAt: readRecordString(row, "created_at") ?? new Date().toISOString(),
        updatedAt: readRecordString(row, "updated_at") ?? new Date().toISOString(),
        approvedBy: readRecordString(row, "approved_by"),
        reviewerNote: readRecordString(row, "reviewer_note"),
        reviewedAt: readRecordString(row, "reviewed_at"),
        postedAt: readRecordString(row, "posted_at"),
      } satisfies FundingRequestRecord;
    })
    .filter((entry): entry is FundingRequestRecord => entry !== null);

  const purchaseOrders = purchaseRows.reduce<PurchaseOrderRecord[]>((rows, row) => {
    const vendor = vendorByDbId.get(readRecordString(row, "vendor_id") ?? "");
    if (!vendor) {
      return rows;
    }
    const responsePayload = readRecordObject(row, "response_payload");
    rows.push({
      id: readRecordString(row, "id") ?? "purchase-missing",
      vendorId: vendor.id,
      walletId: readRecordString(row, "wallet_id") ?? "",
      siteCode: normalizeCode(readRecordString(row, "site_code") ?? vendor.siteCode),
      idempotencyKey: readRecordString(row, "idempotency_key") ?? "",
      meterSn: readRecordString(row, "meter_sn") ?? "",
      customerRef: readRecordString(row, "customer_ref") ?? "",
      amount: roundMoney(readRecordNumber(row, "amount") ?? 0),
      deliveryMethod: toDeliveryMethod(readRecordString(row, "delivery_method")),
      deliveryDestination: readRecordString(row, "delivery_destination"),
      tokenValue: readRecordString(row, "token_value"),
      remoteSendRef: readRecordString(row, "remote_send_ref"),
      receiptRef: readRecordString(row, "receipt_ref"),
      status: toPurchaseStatus(readRecordString(row, "status")),
      actorUserId: readRecordString(row, "requested_by") ?? vendor.contactEmail,
      upstreamEndpoint: "",
      upstreamStatus:
        readRecordString(responsePayload, "failureCode") || readRecordString(row, "status") === "failed"
          ? "stubbed_failure"
          : "stubbed_success",
      failureCode: readRecordString(responsePayload, "failureCode"),
      failureReason: readRecordString(responsePayload, "failureReason"),
      reservedJournalId: readRecordString(row, "reserved_journal_id"),
      finalJournalId: readRecordString(row, "final_journal_id"),
      releasedJournalId: readRecordString(row, "released_journal_id"),
      receiptId: readRecordString(row, "receipt_ref"),
      createdAt: readRecordString(row, "created_at") ?? new Date().toISOString(),
      updatedAt: readRecordString(row, "updated_at") ?? new Date().toISOString(),
      reservedAt:
        readRecordString(row, "reserved_at") ??
        readRecordString(row, "created_at") ??
        new Date().toISOString(),
      settledAt: readRecordString(row, "settled_at"),
      metadata: {
        commissionAmount: readRecordNumber(row, "commission_amount") ?? 0,
        commissionRate: readRecordNumber(responsePayload, "commissionRate") ?? 0,
        receiptNumber: readRecordString(responsePayload, "receiptNumber"),
      },
    });

    return rows;
  }, []);

  const receipts: WalletReceiptRecord[] = receiptRows
    .map((row) => {
      const vendor = vendorByDbId.get(readRecordString(row, "vendor_id") ?? "");
      if (!vendor) {
        return null;
      }
      return {
        id: readRecordString(row, "id") ?? "receipt-missing",
        purchaseOrderId: readRecordString(row, "purchase_order_id") ?? "",
        vendorId: vendor.id,
        siteCode: normalizeCode(readRecordString(row, "site_code") ?? vendor.siteCode),
        deliveryMethod: toDeliveryMethod(readRecordString(row, "delivery_method")),
        meterSn: readRecordString(row, "meter_sn") ?? "",
        customerRef: readRecordString(row, "customer_ref"),
        amount: roundMoney(readRecordNumber(row, "amount") ?? 0),
        tokenValue: readRecordString(row, "token_value"),
        remoteSendRef: readRecordString(row, "remote_send_ref"),
        issuedAt: readRecordString(row, "issued_at") ?? new Date().toISOString(),
        receiptNumber: readRecordString(row, "receipt_number") ?? "",
        issuedBy: readRecordString(row, "issued_by") ?? "system",
        printableContent: "",
      } satisfies WalletReceiptRecord;
    })
    .filter((entry): entry is WalletReceiptRecord => entry !== null);

  const accountCodeById = new Map<string, string>();
  for (const row of accountRows) {
    const accountId = readRecordString(row, "id");
    const accountCode = readRecordString(row, "account_code");
    if (accountId && accountCode) {
      accountCodeById.set(accountId, accountCode);
    }
  }

  const entriesByJournalId = new Map<string, Array<Record<string, unknown>>>();
  for (const row of entryRows) {
    const journalId = readRecordString(row, "journal_id");
    if (!journalId) {
      continue;
    }
    const bucket = entriesByJournalId.get(journalId) ?? [];
    bucket.push(row);
    entriesByJournalId.set(journalId, bucket);
  }

  const ledgerJournals: LedgerJournalRecord[] = journalRows.map((row) => {
    const journalId = readRecordString(row, "id") ?? "journal-missing";
    const vendor = vendorByDbId.get(readRecordString(row, "vendor_id") ?? "");
    const metadata = readRecordObject(row, "metadata");
    return {
      id: journalId,
      walletId: readRecordString(row, "wallet_id") ?? "",
      vendorId: vendor?.id ?? normalizeCode(readRecordString(row, "vendor_id") ?? journalId),
      siteCode: normalizeCode(readRecordString(row, "site_code") ?? vendor?.siteCode ?? "SITE_UNASSIGNED"),
      journalType: toLedgerJournalType(readRecordString(row, "journal_type")),
      reference: readRecordString(row, "reference") ?? journalId,
      status: "posted",
      postedBy: readRecordString(row, "posted_by") ?? "system",
      amount: roundMoney(readRecordNumber(row, "amount") ?? 0),
      createdAt: readRecordString(row, "created_at") ?? new Date().toISOString(),
      metadata,
      entries: (entriesByJournalId.get(journalId) ?? []).map((entryRow) => ({
        id: readRecordString(entryRow, "id") ?? `${journalId}:entry`,
        journalId,
        walletId: readRecordString(entryRow, "wallet_id") ?? "",
        vendorId: vendor?.id ?? normalizeCode(readRecordString(entryRow, "vendor_id") ?? journalId),
        siteCode:
          normalizeCode(readRecordString(entryRow, "site_code") ?? vendor?.siteCode ?? "SITE_UNASSIGNED"),
        accountCode: accountCodeById.get(readRecordString(entryRow, "account_id") ?? "") ?? "vendor_float",
        direction: readRecordString(entryRow, "entry_side") === "credit" ? "credit" : "debit",
        amount: roundMoney(readRecordNumber(entryRow, "amount") ?? 0),
        description:
          readRecordString(readRecordObject(entryRow, "metadata"), "description") ??
          readRecordString(row, "journal_type") ??
          "wallet journal entry",
        reference: readRecordString(entryRow, "reference_id") ?? readRecordString(row, "reference") ?? journalId,
        createdAt: readRecordString(entryRow, "created_at") ?? new Date().toISOString(),
        metadata: readRecordObject(entryRow, "metadata"),
      })),
    } satisfies LedgerJournalRecord;
  });

  const reconciliationExceptions: ReconciliationExceptionRecord[] = exceptionRows.map((row) => {
    const vendor = vendorByDbId.get(readRecordString(row, "vendor_id") ?? "");
    const details = readRecordObject(row, "details");
    return {
      id: readRecordString(row, "id") ?? "exception-missing",
      type:
        ((readRecordString(row, "exception_type") ??
          "manual_review_required") as ReconciliationExceptionRecord["type"]),
      severity: toExceptionSeverity(readRecordString(row, "severity")),
      status: toExceptionStatus(readRecordString(row, "status")),
      siteCode: normalizeCode(readRecordString(row, "site_code") ?? vendor?.siteCode ?? "SITE_UNASSIGNED"),
      vendorId: vendor?.id ?? null,
      walletId: readRecordString(row, "wallet_id"),
      purchaseOrderId: readRecordString(row, "purchase_order_id"),
      fundingRequestId: readRecordString(row, "funding_request_id"),
      summary: readRecordString(row, "summary") ?? "Wallet reconciliation exception",
      details,
      detectedAt: readRecordString(row, "created_at") ?? new Date().toISOString(),
      dueAt: readRecordString(row, "due_at") ?? new Date().toISOString(),
      assignee: readRecordString(row, "assignee_user_id"),
      escalatedAt: readRecordString(details, "escalatedAt"),
      escalationReason: readRecordString(details, "escalationReason"),
      resolutionCode: readRecordString(details, "resolutionCode"),
      resolutionNotes: readRecordString(row, "resolution_notes"),
      resolvedAt: readRecordString(row, "resolved_at"),
      resolvedBy: readRecordString(row, "resolved_by"),
    } satisfies ReconciliationExceptionRecord;
  });

  const reconciliationRuns: ReconciliationRunRecord[] = runRows.map((row) => {
    const summary = readRecordObject(row, "summary");
    const stages = Array.isArray(summary.stages)
      ? (summary.stages as ReconciliationRunRecord["stageSummaries"])
      : [];
    return {
      id: readRecordString(row, "id") ?? "run-missing",
      triggeredBy: readRecordString(row, "triggered_by") ?? "system",
      businessDate: readRecordString(row, "business_date") ?? new Date().toISOString().slice(0, 10),
      status: readRecordString(row, "status") === "failed" ? "failed" : "completed",
      startedAt: readRecordString(row, "started_at") ?? new Date().toISOString(),
      completedAt:
        readRecordString(row, "completed_at") ??
        readRecordString(row, "started_at") ??
        new Date().toISOString(),
      stageSummaries: stages,
      exceptionCount: Math.max(0, readRecordNumber(row, "exception_count") ?? 0),
      dryRun: readRecordBoolean(row, "dry_run") === true,
      reportLockedAt: readRecordString(summary, "reportLockedAt"),
    } satisfies ReconciliationRunRecord;
  });

  const batchMap = new Map<string, SettlementBatchRecord>();
  for (const row of settlementRows) {
    const metadata = readRecordObject(row, "metadata");
    const batchId =
      readRecordString(metadata, "externalBatchId") ??
      `${readRecordString(row, "business_date") ?? new Date().toISOString().slice(0, 10)}:${readRecordString(row, "site_code") ?? "site"}`;
    const existing = batchMap.get(batchId) ?? {
      id: batchId,
      businessDate: readRecordString(row, "business_date") ?? new Date().toISOString().slice(0, 10),
      status: ((readRecordString(row, "status") ?? "preview") as SettlementBatchRecord["status"]),
      totalCommissionCredits: 0,
      itemCount: 0,
      createdAt: readRecordString(row, "created_at") ?? new Date().toISOString(),
      postedAt: readRecordString(row, "posted_at"),
      createdBy: readRecordString(row, "created_by"),
      siteBreakdown: [],
    } satisfies SettlementBatchRecord;
    existing.totalCommissionCredits = roundMoney(
      existing.totalCommissionCredits + (readRecordNumber(row, "total_commission_credits") ?? 0),
    );
    existing.itemCount += Math.max(0, readRecordNumber(row, "item_count") ?? 0);
    existing.siteBreakdown?.push({
      siteCode: normalizeCode(readRecordString(row, "site_code") ?? "SITE_UNASSIGNED"),
      totalCommissionCredits: roundMoney(readRecordNumber(row, "total_commission_credits") ?? 0),
      itemCount: Math.max(0, readRecordNumber(row, "item_count") ?? 0),
    });
    batchMap.set(batchId, existing);
  }

  const receiptSequence = receipts.reduce((max, receipt) => {
    const sequence = Number(receipt.receiptNumber.split("-").pop());
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 100000);

  return {
    invitations,
    approvalRequests,
    vendorSessionLogs: [],
    vendors,
    wallets,
    fundingRequests,
    purchaseOrders,
    receipts,
    commissionRules,
    ledgerJournals,
    reconciliationExceptions,
    reconciliationRuns,
    settlementBatches: Array.from(batchMap.values()).sort((left, right) =>
      right.businessDate.localeCompare(left.businessDate),
    ),
    receiptSequence,
    source: "supabase",
  };
}

export async function ensureWalletReadModelHydrated(
  options: { force?: boolean } = {},
): Promise<WalletHydrationResult> {
  if (!options.force && hasDomainFinancialState()) {
    return {
      hydrated: false,
      source: "in-memory",
      loaded: 0,
    };
  }

  let snapshot: WalletPersistenceSnapshot | null = null;
  if (isSupabaseDbEnabled()) {
    try {
      snapshot = await readSupabaseSnapshot();
    } catch (error) {
      if (env.nodeEnv === "production") {
        throw error;
      }
    }
  }

  if (!snapshot) {
    snapshot = readMirrorSnapshot();
  }

  applySnapshotToDomain(snapshot);
  return {
    hydrated: true,
    source: snapshot.source,
    loaded:
      snapshot.wallets.length +
      snapshot.fundingRequests.length +
      snapshot.purchaseOrders.length +
      snapshot.receipts.length +
      snapshot.reconciliationExceptions.length,
  };
}

export function activateVendorCredentials(authUserId: string, activatedAt = new Date().toISOString()) {
  if (!isSupabaseDbEnabled() || !isUuid(authUserId)) {
    return;
  }

  fireAndForget(
    "vendor credential activation",
    (async () => {
      if (!(await isWalletSchemaReady())) {
        return;
      }

      const client = await getWalletDbClient();
      const { error } = await client
        .from("vendor_users")
        .update({
          status: "active",
          activated_at: activatedAt,
          updated_at: activatedAt,
        })
        .eq("auth_user_id", authUserId);

      if (error) {
        throw new Error(`Failed to activate vendor credentials: ${error.message}`);
      }
    })(),
  );
}
