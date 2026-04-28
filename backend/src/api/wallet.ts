import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { sendEnvelope } from "../services/response.js";
import { getWalletAlertsService } from "../services/wallet-alerts.js";
import { getWalletCommissionService } from "../services/wallet-commission.js";
import { getWalletFundingService } from "../services/wallet-funding.js";
import { getWalletHardeningService } from "../services/wallet-hardening.js";
import { getWalletLedgerService } from "../services/wallet-ledger.js";
import { getWalletPurchaseService } from "../services/wallet-purchase.js";
import { getWalletReceiptService } from "../services/wallet-receipt.js";
import { getWalletSettlementService } from "../services/wallet-settlement.js";
import { isSupabaseDbEnabled, searchWarehouseEntities } from "../services/supabase-db.js";
import { createWalletRequestContext, getWalletDomainState } from "../services/wallet-domain-store.js";
import { getVendorWalletRiskService } from "../services/vendor-wallet-risk.js";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readAmount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toStatusCode(error: unknown) {
  const message = error instanceof Error ? error.message : "Wallet request failed";
  if (message === "DUPLICATE_BANK_REFERENCE") {
    return 409;
  }
  if (message.includes("not found")) {
    return 404;
  }
  if (message.includes("Only") || message.includes("cannot") || message.includes("allowed")) {
    return 403;
  }
  return 400;
}

function readLimit(value: unknown, fallback: number) {
  const amount = readAmount(value);
  if (amount === null) {
    return fallback;
  }

  return Math.max(1, Math.trunc(amount));
}

function readBodyString(
  body: Record<string, unknown>,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = readString(body[key]);
    if (value) {
      return value;
    }
  }

  return "";
}

function readBodyAmount(
  body: Record<string, unknown>,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = readAmount(body[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function readStatusList(value: unknown) {
  const raw = readString(value);
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildVendorTransactions(context: ReturnType<typeof createWalletRequestContext>) {
  const purchases = getWalletPurchaseService().listPurchaseHistory(context).rows.map((record) => ({
    id: record.id,
    createdAt: record.createdAt,
    type: "purchase",
    description: `${record.deliveryMethod === "remote_send" ? "Remote send" : "Token"} for ${record.meterSn}`,
    amount: record.amount,
    direction: "debit",
    balanceAfter: null,
    status: record.status,
    vendorId: record.vendorId,
    walletId: record.walletId,
    siteCode: record.siteCode,
    reference: record.remoteSendRef ?? record.tokenValue ?? record.id,
    receiptId: record.receiptId,
    receiptNumber: record.receiptRef,
    meterSn: record.meterSn,
    customerRef: record.customerRef,
    deliveryMethod: record.deliveryMethod,
    upstreamStatus: record.upstreamStatus,
  }));

  const funding = getWalletFundingService().listFundingRequests(context).rows.map((record) => ({
    id: record.id,
    createdAt: record.createdAt,
    type: "fund",
    description: `Funding via ${record.channel.replaceAll("_", " ")}`,
    amount: record.amount,
    direction: "credit",
    balanceAfter: null,
    status: record.status,
    vendorId: record.vendorId,
    walletId: record.walletId,
    siteCode: record.siteCode,
    reference: record.reference,
    receiptId: null,
    receiptNumber: null,
    meterSn: null,
    customerRef: null,
    deliveryMethod: null,
    upstreamStatus: null,
  }));

  return [...purchases, ...funding].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function buildDashboardPayload(context: ReturnType<typeof createWalletRequestContext>, vendorId?: string) {
  const summary = getVendorWalletRiskService().getVendorSummary(context, vendorId);
  const walletOverview = summary.wallet
    ? getWalletLedgerService().buildWalletOverview(summary.wallet.id)
    : null;
  const transactions = buildVendorTransactions(context);
  const recentReceipts = summary.vendor.id
    ? getWalletReceiptService().listReceiptsForVendor(summary.vendor.id).rows.slice(0, 10)
    : [];

  return {
    wallet: walletOverview?.wallet ?? null,
    vendor: {
      ...summary.vendor,
      vendorCode: summary.vendor.vendorCode,
      siteName: summary.vendor.siteCode,
      statusReason: summary.vendor.suspensionReason,
      lastLoginAt: null,
    },
    todayPurchaseCount: transactions.filter((entry) => entry.type === "purchase").length,
    todayPurchaseAmount: transactions
      .filter((entry) => entry.type === "purchase")
      .reduce((total, entry) => total + entry.amount, 0),
    recentTransactions: transactions.slice(0, 10),
    recentReceipts,
  };
}

async function buildMeterSearchResults(
  context: ReturnType<typeof createWalletRequestContext>,
  query: string,
  limit: number,
) {
  const searchTerm = query.trim().toLowerCase();
  const siteCode = context.siteCode ?? "site_001";
    if (isSupabaseDbEnabled() && searchTerm) {
      const warehouseRows = await searchWarehouseEntities({
        query,
        siteId: siteCode,
        limit,
      });
      const rows = warehouseRows
        .filter((entry) => entry.entityType === "meter" || entry.entityType === "customer")
        .map((entry, index) => ({
          id: entry.id || `meter-search-${index + 1}`,
          customerName:
            entry.entityType === "customer"
              ? entry.title
              : ((entry.metadata.customerName as string | undefined) ?? entry.title),
          customerRef:
            (entry.metadata.accountNo as string | undefined) ??
            (entry.metadata.upstreamCustomerId as string | undefined) ??
            entry.id,
          meterSn:
            entry.entityType === "meter"
              ? entry.title
              : ((entry.metadata.meterSn as string | undefined) ?? ""),
          meterType: (entry.metadata.meterType as string | undefined) ?? "Prepaid Meter",
          accountStatus: (entry.metadata.status as string | undefined) ?? "Active",
          siteCode: entry.siteCode ?? siteCode,
          lastVendedAt: entry.updatedAt,
        }))
        .filter((entry) => Boolean(entry.customerRef) && Boolean(entry.meterSn))
        .reduce<Array<{
          id: string;
          customerName: string;
          customerRef: string;
          meterSn: string;
          meterType: string;
          accountStatus: string;
          siteCode: string;
          lastVendedAt: string | null;
        }>>((accumulator, entry) => {
          const duplicate = accumulator.some(
            (existing) =>
              existing.meterSn === entry.meterSn && existing.customerRef === entry.customerRef,
          );
          if (!duplicate) {
            accumulator.push(entry);
          }
          return accumulator;
        }, [])
        .slice(0, limit);

    if (rows.length > 0) {
      return rows;
    }
  }

  const purchases = getWalletPurchaseService().listPurchaseHistory(context).rows;
  const rows = purchases
    .filter((entry) => {
      if (!searchTerm) {
        return true;
      }

      return (
        entry.meterSn.toLowerCase().includes(searchTerm) ||
        entry.customerRef.toLowerCase().includes(searchTerm)
      );
    })
    .slice(0, limit)
    .map((entry, index) => ({
      id: `meter-search-${index + 1}`,
      customerName: entry.customerRef,
      customerRef: entry.customerRef,
      meterSn: entry.meterSn,
      meterType: "Prepaid Meter",
      accountStatus: entry.status === "failed" ? "Attention" : "Active",
      siteCode,
      lastVendedAt: entry.createdAt,
    }));

  if (rows.length > 0) {
    return rows;
  }

  return [
    {
      id: "meter-search-fallback-1",
      customerName: "Sample Site Customer",
      customerRef: "CUST-DEMO-001",
      meterSn: "MTR-DEMO-001",
      meterType: "Prepaid Meter",
      accountStatus: "Active",
      siteCode,
      lastVendedAt: null,
    },
  ];
}

export const walletRouter = Router();

walletRouter.get("/summary", (request, response) => {
  try {
    const vendorId = readString(request.query.vendorId);
    const context = createWalletRequestContext(request as AuthenticatedRequest, vendorId ? { vendorId } : {});
    sendEnvelope(response, 200, buildDashboardPayload(context, vendorId || undefined), "success");
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load wallet summary",
      1,
    );
  }
});

walletRouter.get("/overview", (request, response) => {
  try {
    const vendorId = readString(request.query.vendorId);
    const context = createWalletRequestContext(request as AuthenticatedRequest, vendorId ? { vendorId } : {});
    const summary = getVendorWalletRiskService().getVendorSummary(context, vendorId || undefined);

    if (!summary.wallet) {
      sendEnvelope(response, 404, null, "Wallet has not been provisioned for this vendor", 1);
      return;
    }

    sendEnvelope(
      response,
      200,
      {
        vendor: summary.vendor,
        wallet: getWalletLedgerService().buildWalletOverview(summary.wallet.id),
        purchases: getWalletPurchaseService().listPurchaseHistory(context),
        funding: getWalletFundingService().listFundingRequests(context),
        ...(context.appRole === "super_admin" ||
        context.appRole === "admin" ||
        context.appRole === "finance"
          ? { financeSummary: getWalletSettlementService().buildFinanceDashboardSummary() }
          : {}),
      },
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load wallet overview",
      1,
    );
  }
});

walletRouter.get("/finance/kpis", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    if (!["super_admin", "admin", "finance", "ops_manager"].includes(context.appRole)) {
      sendEnvelope(response, 403, null, "Only internal roles can view wallet finance KPIs", 1);
      return;
    }

    sendEnvelope(
      response,
      200,
      {
        rows: [getWalletSettlementService().buildFinanceDashboardSummary()],
        total: 1,
      },
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load wallet finance KPIs",
      1,
    );
  }
});

walletRouter.get("/wallets", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    if (!["super_admin", "admin", "finance", "ops_manager"].includes(context.appRole)) {
      sendEnvelope(response, 403, null, "Only internal roles can view wallet rows", 1);
      return;
    }

    const state = getWalletDomainState();
    const rows = Array.from(state.wallets.values())
      .map((wallet) => {
        const vendor = state.vendors.get(wallet.vendorId);
        return {
          id: wallet.id,
          walletId: wallet.id,
          vendorId: wallet.vendorId,
          vendorCode: vendor?.vendorCode ?? wallet.vendorId,
          vendorName: vendor?.businessName ?? wallet.vendorId,
          businessName: vendor?.businessName ?? wallet.vendorId,
          siteCode: wallet.siteCode,
          status: wallet.status,
          availableBalance: wallet.availableBalance,
          totalFloat: wallet.availableBalance,
          reservedBalance: wallet.reservedBalance,
          reservedFloat: wallet.reservedBalance,
          creditLimit: wallet.creditLimit,
          totalFunded: wallet.totalFunded,
          totalPurchased: wallet.totalPurchased,
          totalCommissionAccrued: wallet.totalCommissionAccrued,
          totalCommissionSettled: wallet.totalCommissionSettled,
          createdAt: wallet.createdAt,
          updatedAt: wallet.updatedAt,
        };
      })
      .sort((left, right) => left.vendorCode.localeCompare(right.vendorCode));

    sendEnvelope(
      response,
      200,
      {
        rows,
        total: rows.length,
      },
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load wallet rows",
      1,
    );
  }
});

walletRouter.get("/commission/summary", (request, response) => {
  try {
    const vendorId = readString(request.query.vendorId);
    const context = createWalletRequestContext(request as AuthenticatedRequest, vendorId ? { vendorId } : {});
    const effectiveVendorId = vendorId || context.vendorId;
    if (!effectiveVendorId) {
      sendEnvelope(response, 400, null, "vendor context is required", 1);
      return;
    }

    sendEnvelope(
      response,
      200,
      getWalletCommissionService().buildVendorSummary(effectiveVendorId),
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load commission summary",
      1,
    );
  }
});

walletRouter.get("/commission/history", (request, response) => {
  try {
    const vendorId = readString(request.query.vendorId);
    const context = createWalletRequestContext(request as AuthenticatedRequest, vendorId ? { vendorId } : {});
    const effectiveVendorId =
      ["super_admin", "admin", "finance", "ops_manager"].includes(context.appRole)
        ? vendorId || undefined
        : context.vendorId ?? undefined;
    sendEnvelope(
      response,
      200,
      getWalletCommissionService().listHistory(effectiveVendorId),
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load commission history",
      1,
    );
  }
});

walletRouter.get("/commission/rules", (request, response) => {
  try {
    sendEnvelope(response, 200, getWalletCommissionService().listRules(), "success");
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load commission rules",
      1,
    );
  }
});

walletRouter.post("/commission/rules/:vendorId", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const rate = readAmount(body.rate);
    if (rate === null) {
      sendEnvelope(response, 400, null, "rate is required", 1);
      return;
    }

    sendEnvelope(
      response,
      200,
      getWalletCommissionService().setRule(request.params.vendorId, rate),
      "Commission rule updated",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to update commission rule",
      1,
    );
  }
});

walletRouter.post("/commission/rules-update", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const row =
      typeof body.row === "object" && body.row !== null
        ? (body.row as Record<string, unknown>)
        : null;
    const vendorId = readString(body.vendorId) || readString(row?.vendorId);
    const rate = readAmount(body.rate);
    if (!vendorId || rate === null) {
      sendEnvelope(response, 400, null, "vendorId and rate are required", 1);
      return;
    }

    sendEnvelope(
      response,
      200,
      getWalletCommissionService().setRule(vendorId, rate),
      "Commission rule updated",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to update commission rule",
      1,
    );
  }
});

walletRouter.get("/settlement/preview", (request, response) => {
  try {
    sendEnvelope(
      response,
      200,
      getWalletSettlementService().previewSettlement(readString(request.query.businessDate) || undefined),
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to preview settlement batch",
      1,
    );
  }
});

walletRouter.post("/settlement/preview", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    sendEnvelope(
      response,
      200,
      getWalletSettlementService().previewSettlement(readString(body.businessDate) || undefined),
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to preview settlement batch",
      1,
    );
  }
});

walletRouter.post("/settlement/run", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    sendEnvelope(
      response,
      200,
      getWalletSettlementService().runSettlementBatch(
        context,
        readString(body.businessDate) || undefined,
      ),
      "Settlement batch posted",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to post settlement batch",
      1,
    );
  }
});

walletRouter.get("/settlement/batches", (request, response) => {
  try {
    sendEnvelope(response, 200, getWalletSettlementService().listSettlementBatches(), "success");
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to list settlement batches",
      1,
    );
  }
});

walletRouter.get("/settlement/batches/:settlementRef", (request, response) => {
  try {
    const batch = getWalletSettlementService().getSettlementBatch(request.params.settlementRef);
    if (!batch) {
      sendEnvelope(response, 404, null, "Settlement batch not found", 1);
      return;
    }

    sendEnvelope(response, 200, batch, "success");
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load settlement batch",
      1,
    );
  }
});

walletRouter.get("/approvals", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    sendEnvelope(
      response,
      200,
      getWalletHardeningService().listApprovals(context, {
        status: readString(request.query.status) || undefined,
        requestType: readString(request.query.requestType) || undefined,
      }),
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load wallet approval queue",
      1,
    );
  }
});

walletRouter.get("/security/session-log", (request, response) => {
  try {
    const vendorId = readString(request.query.vendorId);
    const context = createWalletRequestContext(request as AuthenticatedRequest, vendorId ? { vendorId } : {});
    sendEnvelope(
      response,
      200,
      getWalletHardeningService().listSessionLogs(context, vendorId || undefined),
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load vendor session log",
      1,
    );
  }
});

walletRouter.get("/alerts", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    sendEnvelope(
      response,
      200,
      getWalletAlertsService().list(context, {
        severity: readString(request.query.severity) || undefined,
        category: readString(request.query.category) || undefined,
      }),
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load wallet alerts",
      1,
    );
  }
});

walletRouter.get("/go-live-readiness", async (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    sendEnvelope(
      response,
      200,
      await getWalletHardeningService().buildGoLiveReadiness(context),
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to evaluate wallet go-live readiness",
      1,
    );
  }
});

walletRouter.get("/transactions", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    const rows = buildVendorTransactions(context);
    const search = readString(request.query.search).toLowerCase();
    const type = readString(request.query.type);
    const fromDate = readString(request.query.fromDate);
    const toDate = readString(request.query.toDate);
    const vendorId = readString(request.query.vendorId);
    const siteCode = readString(request.query.siteCode);
    const filtered = rows.filter((entry) => {
      if (type && type !== "all" && entry.type !== type) {
        return false;
      }
      if (fromDate && entry.createdAt.slice(0, 10) < fromDate) {
        return false;
      }
      if (toDate && entry.createdAt.slice(0, 10) > toDate) {
        return false;
      }
      if (vendorId && entry.vendorId !== vendorId) {
        return false;
      }
      if (siteCode && entry.siteCode !== siteCode) {
        return false;
      }
      if (!search) {
        return true;
      }
      return (
        entry.description.toLowerCase().includes(search) ||
        (entry.reference ?? "").toLowerCase().includes(search) ||
        (entry.meterSn ?? "").toLowerCase().includes(search)
      );
    });

    sendEnvelope(
      response,
      200,
      {
        rows: filtered.slice(0, readLimit(request.query.limit, 25)),
        total: filtered.length,
      },
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to list transactions",
      1,
    );
  }
});

walletRouter.get("/statement", (request, response) => {
  try {
    const vendorId = readString(request.query.vendorId);
    const context = createWalletRequestContext(request as AuthenticatedRequest, vendorId ? { vendorId } : {});
    const summary = getVendorWalletRiskService().getVendorSummary(context, vendorId || undefined);
    if (!summary.wallet) {
      sendEnvelope(response, 404, null, "Wallet has not been provisioned for this vendor", 1);
      return;
    }

    sendEnvelope(
      response,
      200,
      (() => {
        const statement = getWalletLedgerService().buildStatement(summary.wallet.id, {
          fromDate: readString(request.query.fromDate) || undefined,
          toDate: readString(request.query.toDate) || undefined,
        });

        return {
          rows: statement.rows.map((row) => ({
            id: row.journalId,
            createdAt: row.date,
            reference: row.reference,
            description: row.description,
            type: row.journalType,
            debit: row.debit,
            credit: row.credit,
            balanceAfter: row.balanceAfter,
          })),
          total: statement.total,
        };
      })(),
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to build wallet statement",
      1,
    );
  }
});

walletRouter.get("/history", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    sendEnvelope(response, 200, getWalletPurchaseService().listPurchaseHistory(context), "success");
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to list purchase history",
      1,
    );
  }
});

walletRouter.get("/receipts", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    const vendorId = context.vendorId ?? readString(request.query.vendorId);
    if (!vendorId) {
      sendEnvelope(response, 400, null, "vendor context is required", 1);
      return;
    }

    const search = readString(request.query.search).toLowerCase();
    const deliveryMethod = readString(request.query.deliveryMethod);
    const allRows = getWalletReceiptService().listReceiptsForVendor(vendorId).rows;
    const rows = allRows.filter((entry) => {
      if (deliveryMethod && deliveryMethod !== "all" && entry.deliveryMethod !== deliveryMethod) {
        return false;
      }
      if (!search) {
        return true;
      }
      return (
        entry.receiptNumber.toLowerCase().includes(search) ||
        entry.meterSn.toLowerCase().includes(search) ||
        (entry.customerRef ?? "").toLowerCase().includes(search)
      );
    });

    sendEnvelope(
      response,
      200,
      {
        rows: rows.slice(0, readLimit(request.query.limit, 25)),
        total: rows.length,
      },
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to list receipts",
      1,
    );
  }
});

walletRouter.get("/profile", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    const summary = getVendorWalletRiskService().getVendorSummary(context);
    sendEnvelope(
      response,
      200,
      {
        user: (request as AuthenticatedRequest).authSession?.user ?? null,
        vendor: {
          ...summary.vendor,
          vendorCode: summary.vendor.vendorCode,
          legalName: summary.vendor.legalName,
          displayName: summary.vendor.displayName,
          bankName: summary.vendor.bankName,
          accountName: summary.vendor.bankAccountName,
          accountNumberMasked: summary.vendor.bankAccountNumber
            ? `****${summary.vendor.bankAccountNumber.slice(-4)}`
            : null,
          bankSortCode: summary.vendor.bankSortCode,
          businessAddress: summary.vendor.businessAddress,
          contactPhone: summary.vendor.contactPhone,
          alternateContactName: summary.vendor.alternateContactName,
          alternateContactPhone: summary.vendor.alternateContactPhone,
          registrationNumber: summary.vendor.registrationNumber,
          taxId: summary.vendor.taxId,
          kycStatus: summary.vendor.kycStatus,
          kycDocumentCount: summary.vendor.kycDocumentCount,
          onboardingSubmittedAt: summary.vendor.onboardingSubmittedAt,
          onboardingNotes: summary.vendor.onboardingNotes,
          siteName: summary.vendor.siteCode,
        },
        wallet: summary.wallet
          ? {
              id: summary.wallet.id,
              walletNumber: summary.wallet.id,
              status: summary.wallet.status,
              availableBalance: summary.wallet.availableBalance,
              reservedBalance: summary.wallet.reservedBalance,
            }
          : null,
      },
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load vendor wallet profile",
      1,
    );
  }
});

walletRouter.get("/meters/search", async (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    sendEnvelope(
      response,
      200,
      await buildMeterSearchResults(context, readString(request.query.q), readLimit(request.query.limit, 8)),
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to search vendor meters",
      1,
    );
  }
});

walletRouter.get("/:walletId/purchases", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    const page = Math.max(1, readLimit(request.query.page, 1));
    const limit = readLimit(request.query.limit, 25);
    const rows = getWalletPurchaseService().listPurchaseHistory(context, {
      walletId: request.params.walletId,
      deliveryMethod: (readString(request.query.deliveryMethod) as "remote_send" | "token_generate") || undefined,
      statuses: readStatusList(request.query.statuses).length
        ? (readStatusList(request.query.statuses) as Array<
            "reserved" | "processing" | "success" | "failed" | "reversed"
          >)
        : undefined,
      fromDate: readString(request.query.fromDate) || undefined,
      toDate: readString(request.query.toDate) || undefined,
    });
    const startIndex = (page - 1) * limit;

    sendEnvelope(
      response,
      200,
      {
        rows: rows.rows.slice(startIndex, startIndex + limit),
        total: rows.total,
        page,
        limit,
      },
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to list wallet purchases",
      1,
    );
  }
});

walletRouter.get("/purchase/:purchaseOrderId", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    const purchase = getWalletPurchaseService().getPurchase(context, request.params.purchaseOrderId);
    if (!purchase) {
      sendEnvelope(response, 404, null, "Purchase order not found", 1);
      return;
    }

    sendEnvelope(response, 200, purchase, "success");
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load purchase order",
      1,
    );
  }
});

walletRouter.post("/funding/initiate", async (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const amount = readAmount(body.amount);
    const channel = readString(body.channel);

    if (
      amount === null ||
      !["bank_transfer", "cash_at_branch", "cash_branch", "payment_gateway", "internal_transfer"].includes(channel)
    ) {
      sendEnvelope(response, 400, null, "amount and valid channel are required", 1);
      return;
    }

    sendEnvelope(
      response,
      201,
      await getWalletFundingService().createFundingRequest(context, {
        amount,
        channel:
          channel === "cash_branch"
            ? "cash_at_branch"
            : (channel as "bank_transfer" | "cash_at_branch" | "payment_gateway" | "internal_transfer"),
        idempotencyKey: readString(body.idempotencyKey) || readString(body.idempotency_key),
        reference: readString(body.reference) || undefined,
        notes: readString(body.notes) || undefined,
        proofDocumentId: readString(body.proofDocumentId) || undefined,
      }),
      "Funding request created",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to create funding request",
      1,
    );
  }
});

walletRouter.post("/funding/request", async (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const amount = readAmount(body.amount);
    const channel = readString(body.channel);

    if (
      amount === null ||
      !["bank_transfer", "cash_at_branch", "cash_branch", "payment_gateway", "internal_transfer"].includes(channel)
    ) {
      sendEnvelope(response, 400, null, "amount and valid channel are required", 1);
      return;
    }

    sendEnvelope(
      response,
      201,
      await getWalletFundingService().createFundingRequest(context, {
        amount,
        channel:
          channel === "cash_branch"
            ? "cash_at_branch"
            : (channel as "bank_transfer" | "cash_at_branch" | "payment_gateway" | "internal_transfer"),
        idempotencyKey: readString(body.idempotencyKey) || readString(body.idempotency_key),
        reference: readString(body.reference) || undefined,
        notes: readString(body.notes) || undefined,
        proofDocumentId: readString(body.proofDocumentId) || undefined,
      }),
      "Funding request created",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to create funding request",
      1,
    );
  }
});

walletRouter.post("/funding-request", async (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const amount = readAmount(body.amount);
    const channel = readString(body.channel);

    if (
      amount === null ||
      !["bank_transfer", "cash_at_branch", "cash_branch", "payment_gateway", "internal_transfer"].includes(channel)
    ) {
      sendEnvelope(response, 400, null, "amount and valid channel are required", 1);
      return;
    }

    const created = await getWalletFundingService().createFundingRequest(context, {
      amount,
      channel:
        channel === "cash_branch"
          ? "cash_at_branch"
          : (channel as "bank_transfer" | "cash_at_branch" | "payment_gateway" | "internal_transfer"),
      idempotencyKey: readString(body.idempotencyKey) || readString(body.idempotency_key),
      reference: readString(body.reference) || undefined,
      notes: readString(body.notes) || undefined,
      proofDocumentId: readString(body.proofDocumentId) || undefined,
    });

    sendEnvelope(
      response,
      201,
      created.fundingRequest,
      "Funding request created",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to create funding request",
      1,
    );
  }
});

walletRouter.get("/:walletId/funding/history", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    const statuses = readStatusList(request.query.statuses);
    const rows = getWalletFundingService().listFundingRequests(context, {
      walletId: request.params.walletId,
      statuses: statuses.length
        ? (statuses as Array<
            | "initiated"
            | "awaiting_proof"
            | "proof_uploaded"
            | "under_review"
            | "confirmed"
            | "posted"
            | "rejected"
            | "expired"
            | "cancelled"
          >)
        : undefined,
      fromDate: readString(request.query.fromDate) || undefined,
      toDate: readString(request.query.toDate) || undefined,
    });
    const page = Math.max(1, readLimit(request.query.page, 1));
    const limit = readLimit(request.query.limit, 25);
    const startIndex = (page - 1) * limit;

    sendEnvelope(
      response,
      200,
      {
        rows: rows.rows.slice(startIndex, startIndex + limit),
        total: rows.total,
        page,
        limit,
      },
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load funding history",
      1,
    );
  }
});

walletRouter.get("/funding/pending", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    sendEnvelope(
      response,
      200,
      getWalletFundingService().listPendingFundingRequests(context, readString(request.query.searchTerm)),
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load pending funding queue",
      1,
    );
  }
});

walletRouter.get("/funding-request/:fundingRequestId", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    const funding = getWalletFundingService().listFundingRequests(context).rows.find(
      (entry) => entry.id === request.params.fundingRequestId,
    );
    if (!funding) {
      sendEnvelope(response, 404, null, "Funding request not found", 1);
      return;
    }

    sendEnvelope(response, 200, funding, "success");
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load funding request",
      1,
    );
  }
});

walletRouter.post("/funding/:fundingRequestId/upload-proof", async (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const fileName = readString(body.fileName);
    if (!fileName) {
      sendEnvelope(response, 400, null, "fileName is required", 1);
      return;
    }

    sendEnvelope(
      response,
      200,
      await getWalletFundingService().uploadFundingProof(context, request.params.fundingRequestId, {
        fileName,
        documentId: readString(body.documentId) || undefined,
        mimeType: readString(body.mimeType) || undefined,
        fileSize: readAmount(body.fileSize) ?? undefined,
        notes: readString(body.notes) || undefined,
      }),
      "Funding proof uploaded",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to upload funding proof",
      1,
    );
  }
});

walletRouter.post("/funding/:fundingRequestId/proof", async (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const fileName = readString(body.fileName);
    if (!fileName) {
      sendEnvelope(response, 400, null, "fileName is required", 1);
      return;
    }

    sendEnvelope(
      response,
      200,
      await getWalletFundingService().uploadFundingProof(context, request.params.fundingRequestId, {
        fileName,
        documentId: readString(body.documentId) || undefined,
        mimeType: readString(body.mimeType) || undefined,
        fileSize: readAmount(body.fileSize) ?? undefined,
        notes: readString(body.notes) || undefined,
      }),
      "Funding proof uploaded",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to upload funding proof",
      1,
    );
  }
});

walletRouter.post("/funding/:fundingRequestId/approve", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    sendEnvelope(
      response,
      200,
      getWalletFundingService().approveFunding(context, request.params.fundingRequestId, {
        externalBankRef: readString(body.externalBankRef) || undefined,
        reviewerNote: readString(body.reviewerNote) || undefined,
      }),
      "Funding approved and posted",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to approve funding",
      1,
    );
  }
});

walletRouter.post("/funding/:fundingRequestId/reject", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const reason = readString(body.reason);
    if (!reason) {
      sendEnvelope(response, 400, null, "reason is required", 1);
      return;
    }

    sendEnvelope(
      response,
      200,
      getWalletFundingService().rejectFunding(context, request.params.fundingRequestId, {
        reason,
      }),
      "Funding request rejected",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to reject funding request",
      1,
    );
  }
});

walletRouter.post("/funding/reject", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const row =
      typeof body.row === "object" && body.row !== null
        ? (body.row as Record<string, unknown>)
        : null;
    const fundingRequestId = readString(body.fundingRequestId) || readString(row?.id);
    const reason = readString(body.reason);
    if (!fundingRequestId || !reason) {
      sendEnvelope(response, 400, null, "fundingRequestId and reason are required", 1);
      return;
    }

    sendEnvelope(
      response,
      200,
      getWalletFundingService().rejectFunding(context, fundingRequestId, {
        reason,
      }),
      "Funding request rejected",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to reject funding request",
      1,
    );
  }
});

walletRouter.post("/funding/:fundingRequestId/cancel", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    sendEnvelope(
      response,
      200,
      getWalletFundingService().cancelFunding(
        context,
        request.params.fundingRequestId,
        readString(body.note) || readString(body.notes) || undefined,
      ),
      "Funding request cancelled",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to cancel funding request",
      1,
    );
  }
});

walletRouter.post("/funding/approve", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const row =
      typeof body.row === "object" && body.row !== null
        ? (body.row as Record<string, unknown>)
        : null;
    const fundingRequestId = readString(body.fundingRequestId) || readString(row?.id);
    if (!fundingRequestId) {
      sendEnvelope(response, 400, null, "fundingRequestId is required", 1);
      return;
    }

    sendEnvelope(
      response,
      200,
      getWalletFundingService().approveFunding(context, fundingRequestId, {
        externalBankRef: readString(body.externalBankRef) || undefined,
        reviewerNote: readString(body.reviewerNote) || undefined,
      }),
      "Funding approved and posted",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to approve funding from queue",
      1,
    );
  }
});

walletRouter.post("/purchase/remote-send", async (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const amount = readBodyAmount(body, "amount");
    const walletId = readBodyString(body, "wallet_id", "walletId");
    const meterSn = readBodyString(body, "meter_sn", "meterSn");
    const customerRef = readBodyString(body, "customer_ref", "customerRef");
    const idempotencyKey = readBodyString(body, "idempotency_key", "idempotencyKey");
    const siteCode = readBodyString(body, "site_code", "siteCode");

    if (amount === null || !walletId || !meterSn || !customerRef || !idempotencyKey || !siteCode) {
      sendEnvelope(
        response,
        400,
        null,
        "idempotency_key, wallet_id, meter_sn, customer_ref, amount, and site_code are required",
        1,
      );
      return;
    }

    const result = await getWalletPurchaseService().purchaseRemoteSend(context, {
      idempotencyKey,
      walletId,
      meterSn,
      customerRef,
      amount,
      siteCode,
    }, request as AuthenticatedRequest, response);

    sendEnvelope(response, result.receipt ? 200 : 202, result, result.receipt ? "Remote-send purchase completed" : "Remote-send purchase requires follow-up");
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to process remote-send purchase",
      1,
    );
  }
});

walletRouter.post("/purchase/generate-token", async (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const amount = readBodyAmount(body, "amount");
    const walletId = readBodyString(body, "wallet_id", "walletId");
    const meterSn = readBodyString(body, "meter_sn", "meterSn");
    const customerRef = readBodyString(body, "customer_ref", "customerRef");
    const idempotencyKey = readBodyString(body, "idempotency_key", "idempotencyKey");
    const siteCode = readBodyString(body, "site_code", "siteCode");

    if (amount === null || !walletId || !meterSn || !customerRef || !idempotencyKey || !siteCode) {
      sendEnvelope(
        response,
        400,
        null,
        "idempotency_key, wallet_id, meter_sn, customer_ref, amount, and site_code are required",
        1,
      );
      return;
    }

    const result = await getWalletPurchaseService().purchaseGenerateToken(context, {
      idempotencyKey,
      walletId,
      meterSn,
      customerRef,
      amount,
      siteCode,
    }, request as AuthenticatedRequest, response, body);

    sendEnvelope(response, result.receipt ? 200 : 202, result, result.receipt ? "Token purchase completed" : "Token purchase requires follow-up");
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to generate token purchase",
      1,
    );
  }
});

walletRouter.get("/receipt/:receiptId", (request, response) => {
  const receipt = getWalletReceiptService().getReceipt(request.params.receiptId);
  if (!receipt) {
    sendEnvelope(response, 404, null, "Receipt not found", 1);
    return;
  }

  const purchase = getWalletPurchaseService()
    .listPurchaseHistory(createWalletRequestContext(request as AuthenticatedRequest))
    .rows.find((entry) => entry.id === receipt.purchaseOrderId);

  sendEnvelope(
    response,
    200,
    {
      ...receipt,
      receipt: {
        ...receipt,
        customerName: receipt.customerRef,
        vendorName: null,
        vendorCode: null,
        siteName: receipt.siteCode,
        statusLabel: receipt.deliveryMethod === "remote_send" ? "Delivered" : "Generated",
      },
      purchase: purchase
        ? {
            purchaseId: purchase.id,
            status: purchase.status,
            deliveryMethod: purchase.deliveryMethod,
          }
        : null,
    },
    "success",
  );
});

walletRouter.get("/receipt/:receiptId/print", (request, response) => {
  try {
    sendEnvelope(
      response,
      200,
      getWalletReceiptService().renderPrintableReceipt(request.params.receiptId),
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to render receipt",
      1,
    );
  }
});

walletRouter.post("/reversal/request", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const purchaseOrderId = readString(body.purchaseOrderId);
    const reason = readString(body.reason);
    if (!purchaseOrderId || !reason) {
      sendEnvelope(response, 400, null, "purchaseOrderId and reason are required", 1);
      return;
    }

    sendEnvelope(
      response,
      202,
      getWalletHardeningService().requestPurchaseReversal(context, {
        purchaseOrderId,
        reason,
      }),
      "Reversal routed to maker-checker workflow",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to request reversal",
      1,
    );
  }
});

walletRouter.post("/manual-credit/request", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const walletId = readString(body.walletId);
    const amount = readAmount(body.amount);
    const reason = readString(body.reason);
    if (!walletId || amount === null || !reason) {
      sendEnvelope(response, 400, null, "walletId, amount, and reason are required", 1);
      return;
    }

    sendEnvelope(
      response,
      202,
      getWalletHardeningService().requestManualCredit(context, {
        walletId,
        amount,
        reason,
      }),
      "Manual credit routed to maker-checker workflow",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to request manual wallet credit",
      1,
    );
  }
});

walletRouter.post("/limits/:walletId/credit-limit", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const creditLimit = readAmount(body.creditLimit);
    const reason = readString(body.reason);
    if (creditLimit === null) {
      sendEnvelope(response, 400, null, "creditLimit is required", 1);
      return;
    }
    if (!reason) {
      sendEnvelope(response, 400, null, "reason is required", 1);
      return;
    }

    sendEnvelope(
      response,
      202,
      getWalletHardeningService().requestCreditLimitChange(context, {
        walletId: request.params.walletId,
        creditLimit,
        reason,
      }),
      "Credit-limit change routed to maker-checker workflow",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to update wallet credit limit",
      1,
    );
  }
});

walletRouter.post("/freeze/request", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const walletId = readString(body.walletId);
    const reason = readString(body.reason);
    if (!walletId || !reason) {
      sendEnvelope(response, 400, null, "walletId and reason are required", 1);
      return;
    }

    sendEnvelope(
      response,
      202,
      getWalletHardeningService().requestWalletFreeze(context, { walletId, reason }),
      "Wallet freeze routed to maker-checker workflow",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to request wallet freeze",
      1,
    );
  }
});

walletRouter.post("/unfreeze/request", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const walletId = readString(body.walletId);
    const reason = readString(body.reason);
    if (!walletId || !reason) {
      sendEnvelope(response, 400, null, "walletId and reason are required", 1);
      return;
    }

    sendEnvelope(
      response,
      202,
      getWalletHardeningService().requestWalletUnfreeze(context, { walletId, reason }),
      "Wallet unfreeze routed to maker-checker workflow",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to request wallet unfreeze",
      1,
    );
  }
});

walletRouter.post("/approvals/:requestId/approve", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    sendEnvelope(
      response,
      200,
      getWalletHardeningService().approve(context, request.params.requestId),
      "Wallet approval executed",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to approve wallet action",
      1,
    );
  }
});

walletRouter.post("/approvals/:requestId/reject", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const reason = readString(body.reason);
    if (!reason) {
      sendEnvelope(response, 400, null, "reason is required", 1);
      return;
    }

    sendEnvelope(
      response,
      200,
      getWalletHardeningService().reject(context, request.params.requestId, reason),
      "Wallet approval rejected",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to reject wallet action",
      1,
    );
  }
});
