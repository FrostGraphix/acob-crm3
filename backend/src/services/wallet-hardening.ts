import { createHash, randomUUID } from "node:crypto";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { insertAuditLog } from "./supabase-db.js";
import { getWalletAlertsService } from "./wallet-alerts.js";
import { getWalletLedgerService } from "./wallet-ledger.js";
import {
  getWalletPersistenceReadiness,
  persistApprovalRequest,
  persistPurchaseOrder,
  persistWallet,
} from "./wallet-persistence.js";
import {
  getWalletDomainState,
  listApprovalRequests,
  normalizeCode,
  nowIso,
  roundMoney,
  type ApprovalRequestRecord,
  type ApprovalRequestType,
  type PurchaseOrderRecord,
  type VendorSessionLogRecord,
  type WalletRequestContext,
} from "./wallet-domain-store.js";

const RAPID_PURCHASE_WINDOW_MS = 10 * 60_000;
const RAPID_PURCHASE_LIMIT = 5;
const FUNDING_RATE_WINDOW_MS = 60 * 60_000;
const FUNDING_RATE_LIMIT = 3;
const SESSION_ANOMALY_IP_THRESHOLD = 3;
const SESSION_ANOMALY_DEVICE_THRESHOLD = 3;

function isVendorRole(context: WalletRequestContext) {
  return context.appRole === "vendor_user" || context.appRole === "vendor_manager";
}

function isInternalRole(context: WalletRequestContext) {
  return ["super_admin", "admin", "finance", "ops_manager"].includes(context.appRole);
}

function canApproveSensitiveActions(context: WalletRequestContext) {
  return ["super_admin", "admin", "finance"].includes(context.appRole);
}

function resolveBusinessDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function safeAudit(entry: Parameters<typeof insertAuditLog>[0]) {
  void insertAuditLog(entry);
}

function readHeaderValue(request: AuthenticatedRequest, name: string) {
  const value = request.headers[name];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function resolveClientIp(request: AuthenticatedRequest) {
  const forwarded = readHeaderValue(request, "x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }

  return request.ip?.trim() || null;
}

function hashFingerprint(value: string | null) {
  if (!value) {
    return null;
  }

  return createHash("sha256").update(value).digest("hex");
}

function requireWallet(walletId: string) {
  const wallet = getWalletDomainState().wallets.get(walletId);
  if (!wallet) {
    throw new Error(`Wallet ${walletId} was not found`);
  }

  return wallet;
}

function requirePurchaseOrder(purchaseOrderId: string) {
  const order = getWalletDomainState().purchaseOrders.get(purchaseOrderId);
  if (!order) {
    throw new Error(`Purchase order ${purchaseOrderId} was not found`);
  }

  return order;
}

function updateApprovalRequest(request: ApprovalRequestRecord) {
  getWalletDomainState().approvalRequests.set(request.id, request);
  persistApprovalRequest(request);
  return request;
}

function createApprovalRequest(input: {
  requestType: ApprovalRequestType;
  vendorId: string;
  siteCode: string;
  summary: string;
  submittedBy: string;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const now = nowIso();
  const request: ApprovalRequestRecord = {
    id: randomUUID(),
    requestType: input.requestType,
    vendorId: normalizeCode(input.vendorId),
    siteCode: normalizeCode(input.siteCode),
    status: "pending",
    summary: input.summary,
    submittedAt: now,
    submittedBy: input.submittedBy,
    lastUpdatedAt: now,
    checkerId: null,
    checkerAt: null,
    notes: input.notes ?? null,
    metadata: input.metadata ?? {},
  };

  return updateApprovalRequest(request);
}

function setWalletFrozen(walletId: string, reason: string, frozen: boolean) {
  const wallet = requireWallet(walletId);
  wallet.status = frozen ? "frozen" : "active";
  wallet.frozenReason = frozen ? reason.trim() : null;
  wallet.updatedAt = nowIso();
  getWalletDomainState().wallets.set(wallet.id, wallet);
  persistWallet(wallet);
  return wallet;
}

function executeApprovedAction(
  context: WalletRequestContext,
  request: ApprovalRequestRecord,
) {
  switch (request.requestType) {
    case "wallet_manual_credit": {
      const walletId = String(request.metadata.walletId ?? "");
      const amount = Number(request.metadata.amount ?? 0);
      if (!walletId || !Number.isFinite(amount) || amount <= 0) {
        throw new Error("Manual credit approval is missing wallet or amount metadata");
      }

      return getWalletLedgerService().postManualAdjustment({
        walletId,
        vendorId: request.vendorId,
        siteCode: request.siteCode,
        amount,
        direction: "credit",
        reference: `MAC-${request.id}`,
        postedBy: context.actorUserId,
        metadata: {
          description: "Approved manual wallet credit",
          approvalRequestId: request.id,
          reason: request.metadata.reason ?? request.notes,
        },
      });
    }
    case "wallet_credit_limit_change": {
      const walletId = String(request.metadata.walletId ?? "");
      const creditLimit = Number(request.metadata.creditLimit ?? 0);
      if (!walletId || !Number.isFinite(creditLimit) || creditLimit < 0) {
        throw new Error("Credit-limit approval is missing target wallet or credit limit");
      }

      return getWalletLedgerService().updateCreditLimit(walletId, creditLimit);
    }
    case "wallet_freeze": {
      const walletId = String(request.metadata.walletId ?? "");
      if (!walletId) {
        throw new Error("Freeze approval is missing target wallet");
      }

      return setWalletFrozen(walletId, String(request.metadata.reason ?? request.notes ?? "Wallet frozen"), true);
    }
    case "wallet_unfreeze": {
      const walletId = String(request.metadata.walletId ?? "");
      if (!walletId) {
        throw new Error("Unfreeze approval is missing target wallet");
      }

      return setWalletFrozen(walletId, "", false);
    }
    case "purchase_reversal": {
      const purchaseOrderId = String(request.metadata.purchaseOrderId ?? "");
      const order = requirePurchaseOrder(purchaseOrderId);
      if (order.status !== "success") {
        throw new Error("Only successful purchases can be reversed");
      }

      const adjustment = getWalletLedgerService().postManualAdjustment({
        walletId: order.walletId,
        vendorId: order.vendorId,
        siteCode: order.siteCode,
        amount: order.amount,
        direction: "credit",
        reference: `REV-${order.id}`,
        postedBy: context.actorUserId,
        metadata: {
          description: "Approved purchase reversal credit",
          approvalRequestId: request.id,
          purchaseOrderId: order.id,
          reason: request.metadata.reason ?? request.notes,
        },
      });
      order.status = "reversed";
      order.updatedAt = nowIso();
      order.failureCode = "REVERSAL_APPROVED";
      order.failureReason = String(request.metadata.reason ?? request.notes ?? "Approved reversal");
      order.metadata = {
        ...order.metadata,
        reversalApprovalRequestId: request.id,
        reversedAt: order.updatedAt,
        reversedBy: context.actorUserId,
      };
      getWalletDomainState().purchaseOrders.set(order.id, order);
      persistPurchaseOrder(order);
      return {
        purchaseOrder: order,
        wallet: adjustment.wallet,
        journal: adjustment.journal,
      };
    }
    case "vendor_onboarding":
      throw new Error("Vendor onboarding approvals are managed through the onboarding workflow");
  }
}

function getApprovalQueueRows() {
  return listApprovalRequests()
    .filter((request) => request.requestType !== "vendor_onboarding")
    .map((request) => ({
      id: request.id,
      requestId: request.id,
      requestType: request.requestType,
      vendorId: request.vendorId,
      siteCode: request.siteCode,
      status: request.status,
      summary: request.summary,
      submittedAt: request.submittedAt,
      submittedBy: request.submittedBy,
      checkerId: request.checkerId,
      checkerAt: request.checkerAt,
      notes: request.notes,
      metadata: request.metadata,
    }));
}

function ensureApprovalVisible(context: WalletRequestContext, request: ApprovalRequestRecord) {
  if (canApproveSensitiveActions(context)) {
    return;
  }

  if (isVendorRole(context) && normalizeCode(context.vendorId ?? "") === request.vendorId) {
    return;
  }

  throw new Error("You are not allowed to access this approval request");
}

function upsertSessionLog(record: VendorSessionLogRecord) {
  getWalletDomainState().vendorSessionLogs.set(record.id, record);
  return record;
}

function readTimestampList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function buildSessionLogId(context: WalletRequestContext, ipAddress: string | null) {
  return [
    normalizeCode(context.vendorId ?? "UNKNOWN_VENDOR"),
    context.sessionId ?? "no-session",
    resolveBusinessDate(),
    ipAddress ?? "no-ip",
  ].join(":");
}

function collectSessionLogRows(vendorId: string, businessDate: string) {
  return Array.from(getWalletDomainState().vendorSessionLogs.values()).filter(
    (row) => row.vendorId === vendorId && row.businessDate === businessDate,
  );
}

export const walletHardeningService = {
  recordRequestActivity(
    request: AuthenticatedRequest,
    context: WalletRequestContext,
    pathname: string,
  ) {
    if (!isVendorRole(context) || !context.vendorId || !context.siteCode) {
      return { allowed: true as const };
    }

    const businessDate = resolveBusinessDate();
    const ipAddress = resolveClientIp(request);
    const userAgent = readHeaderValue(request, "user-agent");
    const deviceFingerprintHash = hashFingerprint(readHeaderValue(request, "x-device-fingerprint"));
    const logId = buildSessionLogId(context, ipAddress);
    const existing = getWalletDomainState().vendorSessionLogs.get(logId);
    const now = nowIso();
    const recentPurchaseAttempts = (existing?.recentPurchaseAttempts ?? []).filter((timestamp) => {
      const parsed = Date.parse(timestamp);
      return Number.isFinite(parsed) && Date.now() - parsed <= RAPID_PURCHASE_WINDOW_MS;
    });
    const recentFundingAttempts = readTimestampList(existing?.metadata.recentFundingAttempts).filter(
      (timestamp) => {
        const parsed = Date.parse(timestamp);
        return Number.isFinite(parsed) && Date.now() - parsed <= FUNDING_RATE_WINDOW_MS;
      },
    );
    if (pathname.startsWith("/api/wallet/purchase/")) {
      recentPurchaseAttempts.push(now);
    }
    if (
      pathname === "/api/wallet/funding/initiate" ||
      pathname === "/api/wallet/funding/request" ||
      pathname === "/api/wallet/funding-request"
    ) {
      recentFundingAttempts.push(now);
    }

    const record: VendorSessionLogRecord = {
      id: logId,
      vendorId: normalizeCode(context.vendorId),
      authUserId: context.actorUserId || null,
      siteCode: normalizeCode(context.siteCode),
      sessionId: context.sessionId,
      ipAddress,
      userAgent,
      deviceFingerprintHash,
      businessDate,
      purchaseCountBusinessDay:
        (existing?.purchaseCountBusinessDay ?? 0) + (pathname.startsWith("/api/wallet/purchase/") ? 1 : 0),
      recentPurchaseAttempts,
      firstSeenAt: existing?.firstSeenAt ?? now,
      lastSeenAt: now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      metadata: {
        ...(existing?.metadata ?? {}),
        lastPathname: pathname,
        recentFundingAttempts,
        fundingCountBusinessDay:
          Number(existing?.metadata.fundingCountBusinessDay ?? 0) +
          (pathname.includes("/api/wallet/funding") && pathname.includes("initiate") ? 1 : 0),
      },
    };
    upsertSessionLog(record);

    const sessionLogs = collectSessionLogRows(record.vendorId, businessDate);
    const uniqueIps = new Set(sessionLogs.map((row) => row.ipAddress).filter(Boolean));
    const uniqueDevices = new Set(sessionLogs.map((row) => row.deviceFingerprintHash).filter(Boolean));

    if (recentPurchaseAttempts.length > RAPID_PURCHASE_LIMIT) {
      const wallet = getWalletLedgerService().getWalletByVendorId(record.vendorId);
      if (wallet && wallet.status === "active") {
        setWalletFrozen(
          wallet.id,
          "Wallet frozen automatically after rapid purchase attempts pending review",
          true,
        );
        safeAudit({
          actor_user_id: context.actorUserId,
          action: "wallet_auto_freeze",
          entity_type: "vendor_wallet",
          entity_id: wallet.id,
          site_code: wallet.siteCode,
          metadata: {
            vendorId: record.vendorId,
            reason: "rapid_purchase_attempts",
            attemptsInWindow: recentPurchaseAttempts.length,
          },
        });
        getWalletAlertsService().emit({
          category: "purchase_rate_limit",
          severity: "critical",
          title: "Vendor Purchase Rate Limit Triggered",
          message: `Vendor ${record.vendorId} exceeded the rapid purchase threshold and the wallet was frozen.`,
          source: "wallet-hardening",
          siteCode: wallet.siteCode,
          vendorId: record.vendorId,
          walletId: wallet.id,
          dedupeKey: `purchase-rate-limit:${businessDate}:${wallet.id}`,
          metadata: {
            attemptsInWindow: recentPurchaseAttempts.length,
          },
        });
      }

      return {
        allowed: false as const,
        statusCode: 429,
        reason: "PURCHASE_RATE_LIMIT_EXCEEDED",
      };
    }

    if (recentFundingAttempts.length > FUNDING_RATE_LIMIT) {
      const wallet = getWalletLedgerService().getWalletByVendorId(record.vendorId);
      getWalletAlertsService().emit({
        category: "funding_rate_limit",
        severity: "warning",
        title: "Vendor Funding Rate Limit Triggered",
        message: `Vendor ${record.vendorId} exceeded the hourly funding initiation limit.`,
        source: "wallet-hardening",
        siteCode: wallet?.siteCode ?? record.siteCode,
        vendorId: record.vendorId,
        walletId: wallet?.id ?? null,
        dedupeKey: `funding-rate-limit:${businessDate}:${record.vendorId}`,
        metadata: {
          attemptsInWindow: recentFundingAttempts.length,
        },
      });

      return {
        allowed: false as const,
        statusCode: 429,
        reason: "FUNDING_RATE_LIMIT_EXCEEDED",
      };
    }

    if (
      uniqueIps.size >= SESSION_ANOMALY_IP_THRESHOLD ||
      uniqueDevices.size >= SESSION_ANOMALY_DEVICE_THRESHOLD
    ) {
      const wallet = getWalletLedgerService().getWalletByVendorId(record.vendorId);
      if (wallet && wallet.status === "active") {
        setWalletFrozen(
          wallet.id,
          "Wallet frozen automatically after vendor session anomaly detection",
          true,
        );
        safeAudit({
          actor_user_id: context.actorUserId,
          action: "wallet_auto_freeze",
          entity_type: "vendor_wallet",
          entity_id: wallet.id,
          site_code: wallet.siteCode,
          metadata: {
            vendorId: record.vendorId,
            reason: "session_anomaly",
            uniqueIps: uniqueIps.size,
            uniqueDevices: uniqueDevices.size,
          },
        });
        getWalletAlertsService().emit({
          category: "fraud_review",
          severity: "critical",
          title: "Vendor Session Anomaly Detected",
          message: `Vendor ${record.vendorId} triggered a wallet freeze after multiple IP or device fingerprints were detected.`,
          source: "wallet-hardening",
          siteCode: wallet.siteCode,
          vendorId: record.vendorId,
          walletId: wallet.id,
          dedupeKey: `session-anomaly:${businessDate}:${wallet.id}`,
          metadata: {
            uniqueIps: uniqueIps.size,
            uniqueDevices: uniqueDevices.size,
          },
        });
      }

      return {
        allowed: false as const,
        statusCode: 403,
        reason: "SESSION_ANOMALY_REVIEW_REQUIRED",
      };
    }

    return { allowed: true as const };
  },

  listApprovals(context: WalletRequestContext, filters: { status?: string; requestType?: string } = {}) {
    if (!isInternalRole(context)) {
      throw new Error("Only internal roles can view wallet approvals");
    }

    const rows = getApprovalQueueRows().filter((row) => {
      if (filters.status && row.status !== filters.status) {
        return false;
      }
      if (filters.requestType && row.requestType !== filters.requestType) {
        return false;
      }
      return true;
    });

    return {
      rows,
      total: rows.length,
    };
  },

  getApproval(context: WalletRequestContext, requestId: string) {
    const request = getWalletDomainState().approvalRequests.get(requestId);
    if (!request || request.requestType === "vendor_onboarding") {
      return null;
    }

    ensureApprovalVisible(context, request);
    return request;
  },

  approve(context: WalletRequestContext, requestId: string) {
    if (!canApproveSensitiveActions(context)) {
      throw new Error("Only finance or admin roles can approve wallet hardening actions");
    }

    const request = getWalletDomainState().approvalRequests.get(requestId);
    if (!request || request.requestType === "vendor_onboarding") {
      throw new Error("Approval request not found");
    }
    if (request.status !== "pending") {
      throw new Error(`Approval request in status ${request.status} cannot be approved`);
    }
    if (request.submittedBy === context.actorUserId) {
      throw new Error("Maker and checker must be different users");
    }

    const execution = executeApprovedAction(context, request);
    request.status = "approved";
    request.checkerId = context.actorUserId;
    request.checkerAt = nowIso();
    request.lastUpdatedAt = request.checkerAt;
    updateApprovalRequest(request);
    safeAudit({
      actor_user_id: context.actorUserId,
      action: "approval_approved",
      entity_type: "wallet_approval_request",
      entity_id: request.id,
      site_code: request.siteCode,
      metadata: {
        requestType: request.requestType,
        vendorId: request.vendorId,
      },
    });

    return {
      request,
      execution,
    };
  },

  reject(context: WalletRequestContext, requestId: string, reason: string) {
    if (!canApproveSensitiveActions(context)) {
      throw new Error("Only finance or admin roles can reject wallet hardening actions");
    }

    const request = getWalletDomainState().approvalRequests.get(requestId);
    if (!request || request.requestType === "vendor_onboarding") {
      throw new Error("Approval request not found");
    }
    if (request.status !== "pending") {
      throw new Error(`Approval request in status ${request.status} cannot be rejected`);
    }
    if (request.submittedBy === context.actorUserId) {
      throw new Error("Maker and checker must be different users");
    }

    request.status = "rejected";
    request.checkerId = context.actorUserId;
    request.checkerAt = nowIso();
    request.lastUpdatedAt = request.checkerAt;
    request.notes = reason.trim();
    request.metadata = {
      ...request.metadata,
      rejectedReason: reason.trim(),
    };
    updateApprovalRequest(request);

    return {
      request,
    };
  },

  requestManualCredit(
    context: WalletRequestContext,
    input: { walletId: string; amount: number; reason: string },
  ) {
    if (!isInternalRole(context)) {
      throw new Error("Only internal roles can request manual wallet credits");
    }

    const wallet = requireWallet(input.walletId);
    return createApprovalRequest({
      requestType: "wallet_manual_credit",
      vendorId: wallet.vendorId,
      siteCode: wallet.siteCode,
      summary: `Manual credit request for wallet ${wallet.id}`,
      submittedBy: context.actorUserId,
      notes: input.reason.trim(),
      metadata: {
        targetType: "vendor_wallet",
        targetId: wallet.id,
        walletId: wallet.id,
        amount: roundMoney(input.amount),
        reason: input.reason.trim(),
      },
    });
  },

  requestCreditLimitChange(
    context: WalletRequestContext,
    input: { walletId: string; creditLimit: number; reason: string },
  ) {
    if (!isInternalRole(context)) {
      throw new Error("Only internal roles can request credit-limit changes");
    }

    const wallet = requireWallet(input.walletId);
    return createApprovalRequest({
      requestType: "wallet_credit_limit_change",
      vendorId: wallet.vendorId,
      siteCode: wallet.siteCode,
      summary: `Credit-limit change request for wallet ${wallet.id}`,
      submittedBy: context.actorUserId,
      notes: input.reason.trim(),
      metadata: {
        targetType: "vendor_wallet",
        targetId: wallet.id,
        walletId: wallet.id,
        previousCreditLimit: wallet.creditLimit,
        creditLimit: roundMoney(input.creditLimit),
        reason: input.reason.trim(),
      },
    });
  },

  requestWalletFreeze(
    context: WalletRequestContext,
    input: { walletId: string; reason: string },
  ) {
    if (!isInternalRole(context)) {
      throw new Error("Only internal roles can request wallet freeze");
    }

    const wallet = requireWallet(input.walletId);
    return createApprovalRequest({
      requestType: "wallet_freeze",
      vendorId: wallet.vendorId,
      siteCode: wallet.siteCode,
      summary: `Freeze wallet ${wallet.id}`,
      submittedBy: context.actorUserId,
      notes: input.reason.trim(),
      metadata: {
        targetType: "vendor_wallet",
        targetId: wallet.id,
        walletId: wallet.id,
        reason: input.reason.trim(),
      },
    });
  },

  requestWalletUnfreeze(
    context: WalletRequestContext,
    input: { walletId: string; reason: string },
  ) {
    if (!isInternalRole(context)) {
      throw new Error("Only internal roles can request wallet unfreeze");
    }

    const wallet = requireWallet(input.walletId);
    return createApprovalRequest({
      requestType: "wallet_unfreeze",
      vendorId: wallet.vendorId,
      siteCode: wallet.siteCode,
      summary: `Unfreeze wallet ${wallet.id}`,
      submittedBy: context.actorUserId,
      notes: input.reason.trim(),
      metadata: {
        targetType: "vendor_wallet",
        targetId: wallet.id,
        walletId: wallet.id,
        reason: input.reason.trim(),
      },
    });
  },

  requestPurchaseReversal(
    context: WalletRequestContext,
    input: { purchaseOrderId: string; reason: string },
  ) {
    const order = requirePurchaseOrder(input.purchaseOrderId);
    if (normalizeCode(context.vendorId ?? "") !== order.vendorId) {
      throw new Error("You can only request reversals for your own purchases");
    }

    return createApprovalRequest({
      requestType: "purchase_reversal",
      vendorId: order.vendorId,
      siteCode: order.siteCode,
      summary: `Purchase reversal request for ${order.id}`,
      submittedBy: context.actorUserId,
      notes: input.reason.trim(),
      metadata: {
        targetType: "wallet_purchase_order",
        targetId: order.id,
        walletId: order.walletId,
        purchaseOrderId: order.id,
        amount: order.amount,
        reason: input.reason.trim(),
      },
    });
  },

  listSessionLogs(context: WalletRequestContext, vendorId?: string) {
    const effectiveVendorId =
      isVendorRole(context) ? normalizeCode(context.vendorId ?? "") : normalizeCode(vendorId ?? "");
    if (!isInternalRole(context) && !effectiveVendorId) {
      throw new Error("Vendor context is required to view session logs");
    }

    const rows = Array.from(getWalletDomainState().vendorSessionLogs.values())
      .filter((row) => (effectiveVendorId ? row.vendorId === effectiveVendorId : true))
      .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt));

    return {
      rows,
      total: rows.length,
    };
  },

  async buildGoLiveReadiness(context: WalletRequestContext) {
    if (!isInternalRole(context)) {
      throw new Error("Only internal roles can review wallet go-live readiness");
    }

    const persistence = await getWalletPersistenceReadiness();
    const wallets = Array.from(getWalletDomainState().wallets.values());
    const openExceptions = Array.from(getWalletDomainState().reconciliationExceptions.values()).filter(
      (exception) => exception.status !== "resolved",
    );
    const pendingApprovals = listApprovalRequests().filter(
      (request) => request.requestType !== "vendor_onboarding" && request.status === "pending",
    );
    const underReviewFunding = Array.from(getWalletDomainState().fundingRequests.values()).filter(
      (request) => request.status === "under_review",
    );
    const defaultCommissionCoverage = wallets.filter((wallet) =>
      Boolean(getWalletDomainState().commissionRules.get(wallet.vendorId)),
    ).length;
    const frozenWallets = wallets.filter((wallet) => wallet.status === "frozen").length;
    const suspendedWallets = wallets.filter((wallet) => wallet.status === "suspended").length;
    const nearExhaustionWallets = wallets.filter((wallet) => wallet.availableBalance <= 1_000).length;

    const gates = [
      {
        key: "wallet_persistence_ready",
        passed: persistence.mode === "ready" || persistence.mode === "disabled",
        detail: persistence.mode,
      },
      {
        key: "no_open_critical_exceptions",
        passed: openExceptions.filter((exception) => exception.severity === "critical").length === 0,
        detail: openExceptions.filter((exception) => exception.severity === "critical").length,
      },
      {
        key: "no_pending_hardening_approvals",
        passed: pendingApprovals.length === 0,
        detail: pendingApprovals.length,
      },
      {
        key: "commission_rules_seeded_for_wallets",
        passed: defaultCommissionCoverage === wallets.length,
        detail: `${defaultCommissionCoverage}/${wallets.length}`,
      },
      {
        key: "no_stalled_under_review_funding",
        passed: underReviewFunding.length === 0,
        detail: underReviewFunding.length,
      },
    ];

    return {
      overallReady: gates.every((gate) => gate.passed),
      generatedAt: nowIso(),
      gates,
      metrics: {
        totalWallets: wallets.length,
        frozenWallets,
        suspendedWallets,
        nearExhaustionWallets,
        openExceptions: openExceptions.length,
        pendingApprovals: pendingApprovals.length,
        underReviewFunding: underReviewFunding.length,
      },
    };
  },
};

export function getWalletHardeningService() {
  return walletHardeningService;
}
