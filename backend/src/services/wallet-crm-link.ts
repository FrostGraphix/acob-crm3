import { randomUUID } from "node:crypto";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { getVendorWalletRiskService } from "./vendor-wallet-risk.js";
import {
  createWalletRequestContext,
  normalizeCode,
  roundMoney,
  type WalletRequestContext,
} from "./wallet-domain-store.js";
import type { WalletPurchaseInput } from "./wallet-purchase.js";

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function readString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function readNumber(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

export function isWalletScopedCrmContext(context: WalletRequestContext) {
  return context.appRole === "vendor_user" || context.appRole === "vendor_manager";
}

export function createWalletCrmContext(request: AuthenticatedRequest, hints: Record<string, unknown> = {}) {
  return createWalletRequestContext(request, hints);
}

export function resolveWalletCrmScope(context: WalletRequestContext) {
  if (!isWalletScopedCrmContext(context)) {
    return null;
  }

  const summary = getVendorWalletRiskService().getVendorSummary(context);
  if (!summary.wallet) {
    throw new Error("Vendor wallet has not been provisioned");
  }

  return {
    vendorId: summary.vendor.id,
    walletId: summary.wallet.id,
    siteCode: normalizeCode(summary.wallet.siteCode || summary.vendor.siteCode),
    vendor: summary.vendor,
    wallet: summary.wallet,
  };
}

export function applyWalletSiteScopeToBody(
  body: Record<string, unknown>,
  context: WalletRequestContext,
) {
  const scope = resolveWalletCrmScope(context);
  if (!scope) {
    return body;
  }

  return {
    ...body,
    stationId: scope.siteCode,
    StationId: scope.siteCode,
    siteId: scope.siteCode,
    SiteId: scope.siteCode,
    site: scope.siteCode,
    sectionId: scope.siteCode,
    walletId: scope.walletId,
    vendorId: scope.vendorId,
  };
}

export function buildWalletPurchaseInputFromCrm(
  body: Record<string, unknown>,
  context: WalletRequestContext,
  deliveryMethod: "remote_send" | "token_generate",
): WalletPurchaseInput {
  const scope = resolveWalletCrmScope(context);
  if (!scope) {
    throw new Error("Wallet scope is required for vendor CRM purchases");
  }

  const row = asRecord(body.row);
  const amount = readNumber(body, ["amount", "Amount", "totalPaid", "TotalPaid", "price", "totalPrice"]);
  const meterSn =
    readString(body, ["meterId", "MeterId", "meterNo", "MeterNo", "meterSn"]) ??
    readString(row, ["meterId", "MeterId", "meterNo", "MeterNo", "meterSn"]);
  const customerRef =
    readString(body, ["customerId", "CustomerId", "customerNo", "customerRef", "accountNo"]) ??
    readString(row, ["customerId", "CustomerId", "customerNo", "customerRef", "accountNo"]) ??
    meterSn;
  const idempotencyKey =
    readString(body, ["idempotencyKey", "idempotency_key"]) ??
    `crm-${deliveryMethod}-${randomUUID()}`;

  if (amount === null || amount <= 0) {
    throw new Error("A positive amount is required for wallet-linked token purchases");
  }
  if (!meterSn) {
    throw new Error("Meter id is required for wallet-linked token purchases");
  }

  return {
    idempotencyKey,
    walletId: scope.walletId,
    meterSn,
    customerRef: customerRef ?? meterSn,
    amount: roundMoney(amount),
    siteCode: scope.siteCode,
  };
}

export function flattenWalletPurchaseForCrm(result: {
  purchaseOrder: {
    id: string;
    meterSn: string;
    customerRef: string;
    amount: number;
    tokenValue: string | null;
    remoteSendRef: string | null;
    siteCode: string;
    deliveryMethod: string;
    status: string;
  };
  receipt: { id: string; receiptNumber: string } | null;
  upstream: unknown;
}) {
  const upstream = asRecord(result.upstream);
  const upstreamPayload =
    typeof upstream.payload === "object" && upstream.payload !== null
      ? (upstream.payload as Record<string, unknown>)
      : {};

  return {
    ...result,
    walletLinked: true,
    purchaseOrderId: result.purchaseOrder.id,
    receiptId: result.receipt?.id ?? result.purchaseOrder.id,
    receiptNumber: result.receipt?.receiptNumber ?? result.purchaseOrder.id,
    meterId: result.purchaseOrder.meterSn,
    MeterId: result.purchaseOrder.meterSn,
    customerId: result.purchaseOrder.customerRef,
    customerName: upstreamPayload.customerName ?? result.purchaseOrder.customerRef,
    stationId: result.purchaseOrder.siteCode,
    totalPaid: result.purchaseOrder.amount,
    amount: result.purchaseOrder.amount,
    token: result.purchaseOrder.tokenValue,
    tokenValue: result.purchaseOrder.tokenValue,
    remoteSendRef: result.purchaseOrder.remoteSendRef,
    deliveryMethod: result.purchaseOrder.deliveryMethod,
    status: result.purchaseOrder.status,
  };
}
