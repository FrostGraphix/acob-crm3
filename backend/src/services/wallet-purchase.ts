import { randomUUID } from "node:crypto";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { getWalletCommissionService } from "./wallet-commission.js";
import { getWalletLedgerService } from "./wallet-ledger.js";
import { getWalletPurchaseRemoteService } from "./wallet-purchase-remote.js";
import { getWalletPurchaseTokenService } from "./wallet-purchase-token.js";
import { getWalletReceiptService } from "./wallet-receipt.js";
import {
  persistPurchaseOrder,
  persistReconciliationException,
} from "./wallet-persistence.js";
import { getVendorWalletRiskService } from "./vendor-wallet-risk.js";
import {
  getWalletDomainState,
  normalizeCode,
  nowIso,
  roundMoney,
  type PurchaseDeliveryMethod,
  type PurchaseOrderRecord,
  type VendorWallet,
  type WalletRequestContext,
  type WalletReceiptRecord,
} from "./wallet-domain-store.js";
import type { WalletCommissionAccrualResult } from "./wallet-commission.js";
import type { RemoteSendExecutionResult } from "./wallet-purchase-remote.js";
import type { TokenGenerationExecutionResult } from "./wallet-purchase-token.js";

type WalletPurchaseUpstreamResult = RemoteSendExecutionResult | TokenGenerationExecutionResult;

export interface WalletPurchaseInput {
  idempotencyKey: string;
  walletId: string;
  meterSn: string;
  customerRef: string;
  amount: number;
  siteCode: string;
}

export interface WalletPurchaseResult {
  idempotent: boolean;
  purchaseOrder: PurchaseOrderRecord;
  wallet: VendorWallet | null;
  receipt: WalletReceiptRecord | null;
  commission: WalletCommissionAccrualResult | null;
  upstream: WalletPurchaseUpstreamResult | (Record<string, unknown> & { reconciliationExceptionId?: string });
  phase: "phase-3";
}

function requirePositiveAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number");
  }
}

function buildPurchaseIdempotencyKey(
  deliveryMethod: PurchaseDeliveryMethod,
  vendorId: string,
  walletId: string,
  idempotencyKey: string,
) {
  return `${deliveryMethod}:${normalizeCode(vendorId)}:${walletId}:${idempotencyKey.trim()}`;
}

function requiresScopedWallet(context: WalletRequestContext, walletId: string, siteCode: string) {
  const access = getVendorWalletRiskService().evaluateWalletAccess(context, walletId);
  if (!access.allowed || !access.wallet || !access.vendor) {
    throw new Error(access.reason);
  }

  if (normalizeCode(siteCode) !== access.wallet.siteCode) {
    throw new Error("Wallet site_code does not match the requested purchase site");
  }

  return access;
}

function buildPurchaseOrder(
  context: WalletRequestContext,
  input: WalletPurchaseInput,
  deliveryMethod: PurchaseDeliveryMethod,
): PurchaseOrderRecord {
  const access = requiresScopedWallet(context, input.walletId, input.siteCode);
  const now = nowIso();
  return {
    id: randomUUID(),
    vendorId: access.vendor.id,
    walletId: access.wallet.id,
    siteCode: access.wallet.siteCode,
    idempotencyKey: input.idempotencyKey.trim(),
    meterSn: input.meterSn.trim(),
    customerRef: input.customerRef.trim(),
    amount: roundMoney(input.amount),
    deliveryMethod,
    deliveryDestination: deliveryMethod === "remote_send" ? input.meterSn.trim() : null,
    tokenValue: null,
    remoteSendRef: null,
    receiptRef: null,
    status: "reserved",
    actorUserId: context.actorUserId,
    upstreamEndpoint:
      deliveryMethod === "remote_send"
        ? "/API/RemoteMeterTask/CreateTokenTask"
        : "/api/token/creditToken/generate",
    upstreamStatus: "pending",
    failureCode: null,
    failureReason: null,
    reservedJournalId: null,
    finalJournalId: null,
    releasedJournalId: null,
    receiptId: null,
    createdAt: now,
    updatedAt: now,
    reservedAt: now,
    settledAt: null,
    metadata: {
      appRole: context.appRole,
      authProvider: context.authProvider,
    },
  };
}

function shouldSimulateLocalFailure(order: PurchaseOrderRecord) {
  return (
    order.meterSn.toUpperCase().includes("LOCALFAIL") ||
    order.customerRef.toUpperCase().includes("LOCALFAIL")
  );
}

function createExceptionFromLocalFailure(
  order: PurchaseOrderRecord,
  upstream: WalletPurchaseUpstreamResult,
) {
  const state = getWalletDomainState();
  const exception = {
    id: randomUUID(),
    type: "upstream_success_local_fail" as const,
    severity: "critical" as const,
    status: "open" as const,
    siteCode: order.siteCode,
    vendorId: order.vendorId,
    walletId: order.walletId,
    purchaseOrderId: order.id,
    fundingRequestId: null,
    summary: "Upstream success acknowledged but local wallet finalisation stalled",
    details: {
      upstream,
      purchaseOrderId: order.id,
      idempotencyKey: order.idempotencyKey,
    },
    detectedAt: nowIso(),
    dueAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    assignee: null,
    escalatedAt: null,
    escalationReason: null,
    resolutionCode: null,
    resolutionNotes: null,
    resolvedAt: null,
    resolvedBy: null,
  };
  state.reconciliationExceptions.set(exception.id, exception);
  persistReconciliationException(exception);
  return exception;
}

async function executePurchase(
  context: WalletRequestContext,
  input: WalletPurchaseInput,
  deliveryMethod: PurchaseDeliveryMethod,
  request?: AuthenticatedRequest,
  response?: Response,
  upstreamPayload: Record<string, unknown> = {},
) {
  requirePositiveAmount(input.amount);
  if (!input.idempotencyKey.trim()) {
    throw new Error("idempotency_key is required");
  }
  if (!input.meterSn.trim()) {
    throw new Error("meter_sn is required");
  }
  if (!input.customerRef.trim()) {
    throw new Error("customer_ref is required");
  }

  const access = requiresScopedWallet(context, input.walletId, input.siteCode);
  const state = getWalletDomainState();
  const idempotencyKey = buildPurchaseIdempotencyKey(
    deliveryMethod,
    access.vendor.id,
    access.wallet.id,
    input.idempotencyKey,
  );
  const existing = state.idempotencyResults.get(idempotencyKey) as WalletPurchaseResult | undefined;
  if (existing) {
    return {
      ...existing,
      idempotent: true,
    };
  }

  const inFlight = state.inFlightIdempotency.get(idempotencyKey) as Promise<WalletPurchaseResult> | undefined;
  if (inFlight) {
    const result = await inFlight;
    return {
      ...result,
      idempotent: true,
    };
  }

  const executePromise = (async () => {
    const order = buildPurchaseOrder(context, input, deliveryMethod);
    state.purchaseOrders.set(order.id, order);
    const reserveResult = getWalletLedgerService().reserveFunds({
      walletId: order.walletId,
      vendorId: order.vendorId,
      siteCode: order.siteCode,
      amount: order.amount,
      reference: `RSV-${order.id}`,
      postedBy: context.actorUserId,
      metadata: {
        description: "Wallet purchase reservation",
        purchaseOrderId: order.id,
        deliveryMethod,
      },
    });
    order.reservedJournalId = reserveResult.journal.id;
    order.status = "processing";
    order.updatedAt = nowIso();
    state.purchaseOrders.set(order.id, order);
    persistPurchaseOrder(order);

    const upstream =
      deliveryMethod === "remote_send"
        ? await getWalletPurchaseRemoteService().execute(context, order, request, response)
        : await getWalletPurchaseTokenService().execute(context, order, request, response, upstreamPayload);

    if (!upstream.success) {
      const releaseResult = getWalletLedgerService().releaseReservedFunds({
        walletId: order.walletId,
        vendorId: order.vendorId,
        siteCode: order.siteCode,
        amount: order.amount,
        reference: `REL-${order.id}`,
        postedBy: context.actorUserId,
        metadata: {
          description: "Reservation released after upstream purchase failure",
          purchaseOrderId: order.id,
          deliveryMethod,
        },
      });
      order.status = "failed";
      order.failureCode = "UPSTREAM_FAILED";
      order.failureReason = String(upstream.message);
      order.releasedJournalId = releaseResult.journal.id;
      order.upstreamStatus = upstream.mode === "simulated" ? "stubbed_failure" : "upstream_failure";
      order.updatedAt = nowIso();
      state.purchaseOrders.set(order.id, order);
      persistPurchaseOrder(order);

      const result: WalletPurchaseResult = {
        idempotent: false,
        purchaseOrder: order,
        wallet: releaseResult.wallet,
        receipt: null,
        commission: null,
        upstream,
        phase: "phase-3",
      };
      state.idempotencyResults.set(idempotencyKey, result);
      return result;
    }

    order.upstreamStatus = upstream.mode === "simulated" ? "stubbed_success" : "upstream_success";

    if (shouldSimulateLocalFailure(order)) {
      order.status = "failed";
      order.failureCode = "LOCAL_FINALISATION_PENDING_RECONCILIATION";
      order.failureReason = "Upstream success recorded but local settlement intentionally stalled";
      order.updatedAt = nowIso();
      state.purchaseOrders.set(order.id, order);
      persistPurchaseOrder(order);
      const exception = createExceptionFromLocalFailure(order, upstream);

      const result: WalletPurchaseResult = {
        idempotent: false,
        purchaseOrder: order,
        wallet: getWalletLedgerService().getWalletById(order.walletId),
        receipt: null,
        commission: null,
        upstream: {
          ...upstream,
          reconciliationExceptionId: exception.id,
        },
        phase: "phase-3",
      };
      state.idempotencyResults.set(idempotencyKey, result);
      return result;
    }

    const finalisation = getWalletLedgerService().postPurchaseSettlement({
      walletId: order.walletId,
      vendorId: order.vendorId,
      siteCode: order.siteCode,
      amount: order.amount,
      reference: `PUR-${order.id}`,
      postedBy: context.actorUserId,
      metadata: {
        description: "Vendor wallet purchase settlement",
        purchaseOrderId: order.id,
        deliveryMethod,
      },
    });

    const vendor = getVendorWalletRiskService().getVendorSummary(context, order.vendorId).vendor;
    const receipt = getWalletReceiptService().issueReceipt({
      purchaseOrderId: order.id,
      vendorId: order.vendorId,
      vendorName: vendor.businessName,
      vendorCode: vendor.vendorCode,
      siteCode: order.siteCode,
      issuedBy: context.actorUserId,
      meterSn: order.meterSn,
      customerRef: order.customerRef,
      amount: order.amount,
      deliveryMethod,
      tokenValue: "tokenValue" in upstream ? (upstream.tokenValue as string | null) : null,
      remoteSendRef: "remoteSendRef" in upstream ? (upstream.remoteSendRef as string | null) : null,
    });
    const commission = getWalletCommissionService().accruePurchaseCommission(context, order);

    order.status = "success";
    order.tokenValue = "tokenValue" in upstream ? (upstream.tokenValue as string | null) : null;
    order.remoteSendRef =
      "remoteSendRef" in upstream ? (upstream.remoteSendRef as string | null) : null;
    order.receiptRef = receipt.id;
    order.receiptId = receipt.id;
    order.finalJournalId = finalisation.journal.id;
    order.settledAt = nowIso();
    order.updatedAt = order.settledAt;
    order.metadata = {
      ...order.metadata,
      commissionAmount: commission.amount,
      commissionRate: commission.rate,
      zeroRateCommission: commission.zeroRate,
      receiptNumber: receipt.receiptNumber,
    };
    state.purchaseOrders.set(order.id, order);
    persistPurchaseOrder(order);

    const result: WalletPurchaseResult = {
      idempotent: false,
      purchaseOrder: order,
      wallet: finalisation.wallet,
      receipt,
      commission,
      upstream,
      phase: "phase-3",
    };
    state.idempotencyResults.set(idempotencyKey, result);
    return result;
  })();
  state.inFlightIdempotency.set(idempotencyKey, executePromise);
  try {
    return await executePromise;
  } finally {
    state.inFlightIdempotency.delete(idempotencyKey);
  }
}

export const walletPurchaseService = {
  purchaseRemoteSend(
    context: WalletRequestContext,
    input: WalletPurchaseInput,
    request?: AuthenticatedRequest,
    response?: Response,
  ) {
    return executePurchase(context, input, "remote_send", request, response);
  },

  purchaseGenerateToken(
    context: WalletRequestContext,
    input: WalletPurchaseInput,
    request?: AuthenticatedRequest,
    response?: Response,
    upstreamPayload: Record<string, unknown> = {},
  ) {
    return executePurchase(context, input, "token_generate", request, response, upstreamPayload);
  },

  getPurchase(context: WalletRequestContext, purchaseOrderId: string) {
    const purchase = getWalletDomainState().purchaseOrders.get(purchaseOrderId);
    if (!purchase) {
      return null;
    }

    const scoped = this.listPurchaseHistory(context, {
      walletId: purchase.walletId,
    }).rows.find((row) => row.id === purchaseOrderId);

    return scoped ?? null;
  },

  listPurchaseHistory(
    context: WalletRequestContext,
    options: {
      walletId?: string;
      deliveryMethod?: PurchaseDeliveryMethod;
      statuses?: PurchaseOrderRecord["status"][];
      fromDate?: string;
      toDate?: string;
    } = {},
  ) {
    const rows = Array.from(getWalletDomainState().purchaseOrders.values())
      .filter((order) => {
        const sameVendor = normalizeCode(context.vendorId ?? "") === order.vendorId;
        if (context.appRole === "super_admin" || context.appRole === "admin" || context.appRole === "finance") {
          return true;
        }
        if (context.appRole === "ops_manager" && context.siteCode) {
          return order.siteCode === context.siteCode;
        }
        return sameVendor;
      })
      .filter((order) => (options.walletId ? order.walletId === options.walletId : true))
      .filter((order) => (options.deliveryMethod ? order.deliveryMethod === options.deliveryMethod : true))
      .filter((order) => (options.statuses?.length ? options.statuses.includes(order.status) : true))
      .filter((order) => (options.fromDate ? order.createdAt.slice(0, 10) >= options.fromDate : true))
      .filter((order) => (options.toDate ? order.createdAt.slice(0, 10) <= options.toDate : true))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return {
      rows,
      total: rows.length,
    };
  },

  requestReversal(context: WalletRequestContext, purchaseOrderId: string, reason: string) {
    const order = getWalletDomainState().purchaseOrders.get(purchaseOrderId);
    if (!order) {
      throw new Error(`Purchase order ${purchaseOrderId} was not found`);
    }

    if (normalizeCode(context.vendorId ?? "") !== order.vendorId) {
      throw new Error("You can only request reversals for your own purchases");
    }

    return {
      accepted: true,
      phase: "phase-6",
      workflow: "maker-checker-required",
      purchaseOrderId,
      requestedBy: context.actorUserId,
      reason: reason.trim(),
    };
  },
};

export function getWalletPurchaseService() {
  return walletPurchaseService;
}
