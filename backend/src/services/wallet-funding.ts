import { randomUUID } from "node:crypto";
import { getWalletLedgerService } from "./wallet-ledger.js";
import { persistFundingRequest } from "./wallet-persistence.js";
import { getDocumentById, insertAuditLog, isSupabaseDbEnabled } from "./supabase-db.js";
import { getVendorWalletRiskService } from "./vendor-wallet-risk.js";
import {
  getWalletDomainState,
  normalizeCode,
  nowIso,
  roundMoney,
  type FundingChannel,
  type FundingRequestRecord,
  type WalletRequestContext,
} from "./wallet-domain-store.js";

const FUNDING_MIN_AMOUNT = 100;
const FUNDING_DAILY_LIMIT = 5_000_000;
const FUNDING_EXPIRY_HOURS = 72;
const ALLOWED_PROOF_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_PROOF_BYTES = 5 * 1024 * 1024;

export interface WalletFundingRequestInput {
  amount: number;
  channel: FundingChannel;
  idempotencyKey: string;
  reference?: string;
  notes?: string;
  proofDocumentId?: string;
}

export interface WalletFundingProofInput {
  fileName: string;
  documentId?: string;
  mimeType?: string;
  fileSize?: number;
  notes?: string;
}

export interface WalletFundingApprovalInput {
  externalBankRef?: string;
  reviewerNote?: string;
}

export interface WalletFundingRejectionInput {
  reason: string;
}

function isInternalRole(context: WalletRequestContext) {
  return context.appRole === "super_admin" || context.appRole === "admin" || context.appRole === "finance";
}

function isVendorRole(context: WalletRequestContext) {
  return context.appRole === "vendor_user" || context.appRole === "vendor_manager";
}

function requireFundingRequest(fundingRequestId: string) {
  const record = getWalletDomainState().fundingRequests.get(fundingRequestId);
  if (!record) {
    throw new Error(`Funding request ${fundingRequestId} was not found`);
  }

  return record;
}

function requireWalletForContext(context: WalletRequestContext) {
  if (!context.vendorId) {
    throw new Error("Vendor context is required for wallet funding");
  }

  const wallet = getWalletLedgerService().getWalletByVendorId(normalizeCode(context.vendorId));
  if (!wallet) {
    throw new Error("Wallet has not been provisioned for this vendor");
  }

  return wallet;
}

function requireActiveFundingContext(context: WalletRequestContext) {
  const wallet = requireWalletForContext(context);
  const vendor = getWalletDomainState().vendors.get(normalizeCode(wallet.vendorId));
  if (!vendor || vendor.status !== "active") {
    throw new Error("Vendor must be active before funding can be initiated");
  }
  if (wallet.status !== "active") {
    throw new Error("Wallet must be active before funding can be initiated");
  }

  return {
    wallet,
    vendor,
  };
}

function vendorScopeAllowed(context: WalletRequestContext, vendorId: string) {
  return isInternalRole(context) || normalizeCode(context.vendorId ?? "") === normalizeCode(vendorId);
}

function createFundingReference() {
  const dateSegment = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const sequence = String(Date.now()).slice(-6);
  return `FND-${dateSegment}-${sequence}`;
}

function normalizeExternalBankRef(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed.toUpperCase() : null;
}

function buildFundingIdempotencyKey(vendorId: string, idempotencyKey: string) {
  return `funding:${normalizeCode(vendorId)}:${idempotencyKey.trim()}`;
}

function safeAudit(entry: Parameters<typeof insertAuditLog>[0]) {
  if (!isSupabaseDbEnabled()) {
    return;
  }

  void insertAuditLog(entry);
}

async function validateFundingProofDocument(documentId: string | null | undefined) {
  if (!documentId) {
    return null;
  }

  if (!isSupabaseDbEnabled()) {
    return {
      id: documentId,
      fileName: documentId,
      mimeType: null,
      fileSize: null,
      storagePath: null,
    };
  }

  const document = await getDocumentById(documentId);
  if (!document) {
    throw new Error("Funding proof document was not found");
  }

  const metadata =
    typeof document.metadata === "object" && document.metadata !== null
      ? (document.metadata as Record<string, unknown>)
      : {};
  const category = typeof metadata.category === "string" ? metadata.category : "";
  const mimeType = typeof document.content_type === "string" ? document.content_type : "";
  const fileSize = typeof document.size_bytes === "number" ? document.size_bytes : null;

  if (category !== "wallet-funding-proof") {
    throw new Error("INVALID_PROOF_FORMAT");
  }
  if (!ALLOWED_PROOF_MIME_TYPES.has(mimeType) || fileSize === null || fileSize > MAX_PROOF_BYTES) {
    throw new Error("INVALID_PROOF_FORMAT");
  }

  return {
    id: document.id,
    fileName: document.file_name,
    mimeType,
    fileSize,
    storagePath: document.storage_path,
  };
}

function validateInlineProofMetadata(input: WalletFundingProofInput) {
  const mimeType = input.mimeType?.trim().toLowerCase() ?? "";
  const fileSize = typeof input.fileSize === "number" ? input.fileSize : null;
  if (!ALLOWED_PROOF_MIME_TYPES.has(mimeType) || fileSize === null || fileSize > MAX_PROOF_BYTES) {
    throw new Error("INVALID_PROOF_FORMAT");
  }
}

function sumFundingAmountForToday(vendorId: string) {
  const today = new Date().toISOString().slice(0, 10);
  return Array.from(getWalletDomainState().fundingRequests.values())
    .filter(
      (record) =>
        record.vendorId === vendorId &&
        record.createdAt.slice(0, 10) === today &&
        !["cancelled", "rejected", "expired"].includes(record.status),
    )
    .reduce((total, record) => total + record.amount, 0);
}

function derivePendingProofStatus(record: FundingRequestRecord) {
  return record.proofUploadedAt || record.proofDocumentId ? "uploaded" : "pending";
}

function isExpired(record: FundingRequestRecord) {
  return Boolean(record.expiresAt && record.expiresAt <= nowIso());
}

function expireFundingRequest(record: FundingRequestRecord) {
  if (
    record.status === "posted" ||
    record.status === "rejected" ||
    record.status === "cancelled" ||
    record.status === "expired"
  ) {
    return false;
  }
  if (!isExpired(record)) {
    return false;
  }

  record.status = "expired";
  record.updatedAt = nowIso();
  getWalletDomainState().fundingRequests.set(record.id, record);
  persistFundingRequest(record);
  safeAudit({
    actor_user_id: null,
    action: "funding_expired",
    entity_type: "wallet_funding_request",
    entity_id: record.id,
    site_code: record.siteCode,
    metadata: {},
  });
  return true;
}

function syncExpiredFundingRequests() {
  for (const record of getWalletDomainState().fundingRequests.values()) {
    expireFundingRequest(record);
  }
}

export const walletFundingService = {
  async createFundingRequest(context: WalletRequestContext, input: WalletFundingRequestInput) {
    syncExpiredFundingRequests();
    const { wallet } = requireActiveFundingContext(context);
    const state = getWalletDomainState();
    const trimmedIdempotencyKey = input.idempotencyKey.trim();
    const operationKey = buildFundingIdempotencyKey(wallet.vendorId, trimmedIdempotencyKey);

    if (!trimmedIdempotencyKey) {
      throw new Error("idempotency_key is required");
    }

    if (input.amount < FUNDING_MIN_AMOUNT) {
      throw new Error("Funding amount must be at least NGN 100");
    }
    if (sumFundingAmountForToday(wallet.vendorId) + input.amount > FUNDING_DAILY_LIMIT) {
      throw new Error("Daily funding limit exceeded");
    }

    const storedResult = state.idempotencyResults.get(operationKey) as
      | {
          fundingRequest: FundingRequestRecord;
          phase: "phase-2";
          idempotent?: boolean;
        }
      | undefined;
    if (storedResult) {
      return {
        ...storedResult,
        idempotent: true,
      };
    }

    const inFlight = state.inFlightIdempotency.get(operationKey) as
      | Promise<{
          fundingRequest: FundingRequestRecord;
          phase: "phase-2";
        }>
      | undefined;
    if (inFlight) {
      const result = await inFlight;
      return {
        ...result,
        idempotent: true,
      };
    }

    const createPromise = (async () => {
      const reference = input.reference?.trim() || createFundingReference();
      const duplicate = Array.from(state.fundingRequests.values()).find((record) => record.reference === reference);
      if (duplicate) {
        throw new Error("Duplicate funding reference blocked by scaffold unique constraint");
      }

      const now = nowIso();
      const proofDocument = await validateFundingProofDocument(input.proofDocumentId);
      const expiresAt = new Date(Date.now() + FUNDING_EXPIRY_HOURS * 60 * 60_000).toISOString();
      const record: FundingRequestRecord = {
        id: randomUUID(),
        vendorId: wallet.vendorId,
        walletId: wallet.id,
        siteCode: wallet.siteCode,
        idempotencyKey: trimmedIdempotencyKey,
        amount: roundMoney(input.amount),
        channel: input.channel,
        reference,
        externalBankRef: null,
        proofFileName: proofDocument?.fileName ?? null,
        proofDocumentId: proofDocument?.id ?? null,
        proofUploadedAt: proofDocument ? now : null,
        expiresAt,
        status: proofDocument ? "under_review" : "initiated",
        notes: input.notes?.trim() ?? null,
        createdAt: now,
        updatedAt: now,
        approvedBy: null,
        reviewerNote: null,
        reviewedAt: null,
        postedAt: null,
      };

      state.fundingRequests.set(record.id, record);
      persistFundingRequest(record);
      safeAudit({
        actor_user_id: context.actorUserId,
        action: "funding_initiated",
        entity_type: "wallet_funding_request",
        entity_id: record.id,
        site_code: record.siteCode,
        metadata: {
          amount: record.amount,
          channel: record.channel,
          status: record.status,
          expiresAt: record.expiresAt,
        },
      });

      const result = {
        fundingRequest: record,
        phase: "phase-2" as const,
      };
      state.idempotencyResults.set(operationKey, result);
      return result;
    })();
    state.inFlightIdempotency.set(operationKey, createPromise);
    try {
      return await createPromise;
    } finally {
      state.inFlightIdempotency.delete(operationKey);
    }
  },

  async uploadFundingProof(
    context: WalletRequestContext,
    fundingRequestId: string,
    input: WalletFundingProofInput,
  ) {
    syncExpiredFundingRequests();
    const request = requireFundingRequest(fundingRequestId);
    if (!vendorScopeAllowed(context, request.vendorId)) {
      throw new Error("You cannot upload proof for another vendor");
    }
    if (request.status === "expired") {
      throw new Error("FUNDING_EXPIRED");
    }
    if (!["initiated", "awaiting_proof", "proof_uploaded"].includes(request.status)) {
      throw new Error(`Funding request in status ${request.status} cannot accept proof upload`);
    }

    let validatedProof: Awaited<ReturnType<typeof validateFundingProofDocument>> | null = null;
    try {
      validatedProof = input.documentId
        ? await validateFundingProofDocument(input.documentId)
        : (() => {
            validateInlineProofMetadata(input);
            return null;
          })();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Funding proof validation failed";
      if (message === "INVALID_PROOF_FORMAT") {
        getVendorWalletRiskService().recordFundingProofFailure(request.vendorId, message);
      }
      throw error;
    }

    request.proofFileName = validatedProof?.fileName ?? input.fileName.trim();
    request.proofDocumentId = validatedProof?.id ?? input.documentId?.trim() ?? request.proofDocumentId;
    request.proofUploadedAt = nowIso();
    request.status = "under_review";
    request.notes = input.notes?.trim() ?? request.notes;
    request.updatedAt = nowIso();
    getWalletDomainState().fundingRequests.set(request.id, request);
    persistFundingRequest(request);
    safeAudit({
      actor_user_id: context.actorUserId,
      action: "funding_proof_uploaded",
      entity_type: "wallet_funding_request",
      entity_id: request.id,
      site_code: request.siteCode,
      metadata: {
        proofDocumentId: request.proofDocumentId,
      },
    });

    return {
      fundingRequest: request,
      nextStatus: "under_review",
    };
  },

  approveFunding(
    context: WalletRequestContext,
    fundingRequestId: string,
    input: WalletFundingApprovalInput = {},
  ) {
    syncExpiredFundingRequests();
    if (!isInternalRole(context)) {
      throw new Error("Only finance or admin roles can approve funding");
    }

    const request = requireFundingRequest(fundingRequestId);
    if (request.status === "expired") {
      throw new Error("FUNDING_EXPIRED");
    }
    if (!["under_review", "confirmed"].includes(request.status)) {
      throw new Error(`Funding request in status ${request.status} cannot be approved`);
    }

    const externalBankRef = normalizeExternalBankRef(input.externalBankRef);
    if (externalBankRef) {
      const duplicate = Array.from(getWalletDomainState().fundingRequests.values()).find(
        (record) =>
          record.id !== request.id &&
          record.externalBankRef &&
          normalizeCode(record.externalBankRef) === normalizeCode(externalBankRef),
      );
      if (duplicate) {
        throw new Error("DUPLICATE_BANK_REFERENCE");
      }
    }

    const ledgerResult = getWalletLedgerService().postFundingCredit({
      walletId: request.walletId,
      vendorId: request.vendorId,
      siteCode: request.siteCode,
      amount: request.amount,
      reference: request.reference,
      postedBy: context.actorUserId,
      metadata: {
        description: "Vendor wallet funding approval",
        fundingRequestId: request.id,
        channel: request.channel,
      },
    });
    const approvedAt = nowIso();
    request.status = "posted";
    request.approvedBy = context.actorUserId;
    request.externalBankRef = externalBankRef ?? request.externalBankRef;
    request.reviewerNote = input.reviewerNote?.trim() ?? request.reviewerNote;
    request.reviewedAt = approvedAt;
    request.postedAt = approvedAt;
    request.updatedAt = approvedAt;
    getWalletDomainState().fundingRequests.set(request.id, request);
    persistFundingRequest(request);
    safeAudit({
      actor_user_id: context.actorUserId,
      action: "funding_approved",
      entity_type: "wallet_funding_request",
      entity_id: request.id,
      site_code: request.siteCode,
      metadata: {
        journalId: ledgerResult.journal.id,
        externalBankRef: request.externalBankRef,
      },
    });

    return {
      fundingRequest: request,
      wallet: ledgerResult.wallet,
      journal: ledgerResult.journal,
    };
  },

  rejectFunding(context: WalletRequestContext, fundingRequestId: string, input: WalletFundingRejectionInput) {
    syncExpiredFundingRequests();
    if (!isInternalRole(context)) {
      throw new Error("Only finance or admin roles can reject funding");
    }

    const request = requireFundingRequest(fundingRequestId);
    if (request.status === "expired") {
      throw new Error("FUNDING_EXPIRED");
    }
    if (!["initiated", "awaiting_proof", "proof_uploaded", "under_review", "confirmed"].includes(request.status)) {
      throw new Error(`Funding request in status ${request.status} cannot be rejected`);
    }

    const reason = input.reason.trim();
    if (reason.length < 5) {
      throw new Error("Funding rejection reason is required");
    }

    request.status = "rejected";
    request.reviewerNote = reason;
    request.reviewedAt = nowIso();
    request.updatedAt = nowIso();
    getWalletDomainState().fundingRequests.set(request.id, request);
    persistFundingRequest(request);
    safeAudit({
      actor_user_id: context.actorUserId,
      action: "funding_rejected",
      entity_type: "wallet_funding_request",
      entity_id: request.id,
      site_code: request.siteCode,
      metadata: {
        reason,
      },
    });

    return {
      fundingRequest: request,
    };
  },

  cancelFunding(context: WalletRequestContext, fundingRequestId: string, note?: string) {
    syncExpiredFundingRequests();
    if (!isVendorRole(context)) {
      throw new Error("Only vendor roles can cancel their own funding requests");
    }

    const request = requireFundingRequest(fundingRequestId);
    if (!vendorScopeAllowed(context, request.vendorId)) {
      throw new Error("You cannot cancel another vendor's funding request");
    }
    if (!["initiated", "awaiting_proof"].includes(request.status)) {
      throw new Error(`Funding request in status ${request.status} cannot be cancelled`);
    }

    request.status = "cancelled";
    request.notes = note?.trim() || request.notes;
    request.updatedAt = nowIso();
    getWalletDomainState().fundingRequests.set(request.id, request);
    persistFundingRequest(request);
    safeAudit({
      actor_user_id: context.actorUserId,
      action: "funding_cancelled",
      entity_type: "wallet_funding_request",
      entity_id: request.id,
      site_code: request.siteCode,
      metadata: {},
    });

    return {
      fundingRequest: request,
    };
  },

  listFundingRequests(
    context: WalletRequestContext,
    options: {
      walletId?: string;
      statuses?: FundingRequestRecord["status"][];
      fromDate?: string;
      toDate?: string;
    } = {},
  ) {
    syncExpiredFundingRequests();
    const rows = Array.from(getWalletDomainState().fundingRequests.values())
      .filter((record) => vendorScopeAllowed(context, record.vendorId))
      .filter((record) => (options.walletId ? record.walletId === options.walletId : true))
      .filter((record) => (options.statuses?.length ? options.statuses.includes(record.status) : true))
      .filter((record) => (options.fromDate ? record.createdAt.slice(0, 10) >= options.fromDate : true))
      .filter((record) => (options.toDate ? record.createdAt.slice(0, 10) <= options.toDate : true))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return {
      rows,
      total: rows.length,
    };
  },

  listPendingFundingRequests(context: WalletRequestContext, searchTerm?: string) {
    syncExpiredFundingRequests();
    if (!isInternalRole(context)) {
      throw new Error("Only finance or admin roles can view pending funding requests");
    }

    const search = (searchTerm ?? "").trim().toLowerCase();
    const rows = Array.from(getWalletDomainState().fundingRequests.values())
      .filter((record) => record.status === "under_review")
      .map((record) => {
        const vendor = getWalletDomainState().vendors.get(record.vendorId);
        const wallet = getWalletLedgerService().getWalletById(record.walletId);
        return {
          id: record.id,
          vendorId: record.vendorId,
          vendorCode: vendor?.vendorCode ?? record.vendorId,
          vendorName: vendor?.businessName ?? record.vendorId,
          walletId: record.walletId,
          walletNumber: wallet?.id ?? record.walletId,
          siteCode: record.siteCode,
          amount: record.amount,
          channel: record.channel,
          reference: record.reference,
          status: record.status,
          proofStatus: derivePendingProofStatus(record),
          proofDocumentId: record.proofDocumentId,
          externalBankRef: record.externalBankRef,
          expiresAt: record.expiresAt,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        };
      })
      .filter((row) => {
        if (!search) {
          return true;
        }

        return (
          row.vendorCode.toLowerCase().includes(search) ||
          row.vendorName.toLowerCase().includes(search) ||
          row.reference.toLowerCase().includes(search) ||
          row.siteCode.toLowerCase().includes(search)
        );
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return {
      rows,
      total: rows.length,
    };
  },
};

export function getWalletFundingService() {
  return walletFundingService;
}
