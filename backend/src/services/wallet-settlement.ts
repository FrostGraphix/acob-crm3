import { randomUUID } from "node:crypto";
import { getWalletAlertsService } from "./wallet-alerts.js";
import { getWalletCommissionService } from "./wallet-commission.js";
import { getWalletLedgerService } from "./wallet-ledger.js";
import { persistSettlementBatch } from "./wallet-persistence.js";
import {
  getWalletDomainState,
  nowIso,
  roundMoney,
  type WalletRequestContext,
} from "./wallet-domain-store.js";

function currentBusinessDate() {
  return nowIso().slice(0, 10);
}

function isFinanceRole(context: WalletRequestContext) {
  return context.appRole === "super_admin" || context.appRole === "admin" || context.appRole === "finance";
}

export const walletSettlementService = {
  previewSettlement(businessDate = currentBusinessDate()) {
    const vendors = Array.from(getWalletDomainState().wallets.values()).map((wallet) => {
      const commission = getWalletCommissionService().listOutstandingCommission(wallet.vendorId);
      return {
        vendorId: wallet.vendorId,
        walletId: wallet.id,
        siteCode: wallet.siteCode,
        businessDate,
        outstandingCommission: commission.totalOutstanding,
      };
    });

    return {
      businessDate,
      rows: vendors,
      totalOutstanding: roundMoney(
        vendors.reduce((sum, vendor) => sum + vendor.outstandingCommission, 0),
      ),
      phase: "phase-5",
    };
  },

  runSettlementBatch(context: WalletRequestContext, businessDate = currentBusinessDate()) {
    if (!isFinanceRole(context)) {
      throw new Error("Only finance or admin roles can run settlement");
    }

    const preview = this.previewSettlement(businessDate);
    const postedRows = preview.rows
      .filter((row) => row.outstandingCommission > 0)
      .map((row) =>
        getWalletLedgerService().postSettlementCredit({
          walletId: row.walletId,
          vendorId: row.vendorId,
          siteCode:
            getWalletLedgerService().getWalletById(row.walletId)?.siteCode ?? "SITE_UNASSIGNED",
          amount: row.outstandingCommission,
          reference: `SET-${businessDate}-${row.vendorId}`,
          postedBy: context.actorUserId,
          metadata: {
            description: "Daily commission settlement batch",
            businessDate,
          },
        }),
      );

    const postedRowSummaries = preview.rows
      .filter((row) => row.outstandingCommission > 0)
      .map((row, index) => ({
        walletId: row.walletId,
        vendorId: row.vendorId,
        siteCode: row.siteCode,
        journalId: postedRows[index]?.journal.id ?? "",
        amount: postedRows[index]?.journal.amount ?? 0,
      }));

    const siteBreakdownMap = new Map<
      string,
      { siteCode: string; totalCommissionCredits: number; itemCount: number }
    >();

    const siteBreakdownSource =
      postedRowSummaries.length > 0
        ? postedRowSummaries
        : preview.rows.map((row) => ({
            siteCode: row.siteCode,
            amount: Math.max(0, row.outstandingCommission),
          }));

    for (const row of siteBreakdownSource) {
      const bucket = siteBreakdownMap.get(row.siteCode) ?? {
        siteCode: row.siteCode,
        totalCommissionCredits: 0,
        itemCount: 0,
      };
      bucket.totalCommissionCredits = roundMoney(bucket.totalCommissionCredits + row.amount);
      if (row.amount > 0) {
        bucket.itemCount += 1;
      }
      siteBreakdownMap.set(row.siteCode, bucket);
    }

    const batch = {
      id: randomUUID(),
      businessDate,
      status: postedRows.length > 0 ? ("posted" as const) : ("preview" as const),
      totalCommissionCredits: roundMoney(
        postedRows.reduce((sum, entry) => sum + entry.journal.amount, 0),
      ),
      itemCount: postedRows.length,
      createdAt: nowIso(),
      postedAt: postedRows.length > 0 ? nowIso() : null,
      createdBy: context.actorUserId,
      siteBreakdown: Array.from(siteBreakdownMap.values()),
    };
    getWalletDomainState().settlementBatches.push(batch);
    persistSettlementBatch(batch);

    return {
      batch,
      rows: postedRowSummaries,
      preview,
      phase: "phase-5",
    };
  },

  buildFinanceDashboardSummary() {
    getWalletAlertsService().syncNearExhaustionAlerts();
    const wallets = Array.from(getWalletDomainState().wallets.values());
    const commission = getWalletCommissionService().listOutstandingCommission();
    const failedPurchaseCount = Array.from(getWalletDomainState().purchaseOrders.values()).filter(
      (order) => order.status === "failed",
    ).length;
    const walletsNearExhaustion = wallets.filter((wallet) => wallet.availableBalance <= 1_000).length;

    return {
      totalVendorFloat: roundMoney(wallets.reduce((sum, wallet) => sum + wallet.availableBalance, 0)),
      totalReserved: roundMoney(wallets.reduce((sum, wallet) => sum + wallet.reservedBalance, 0)),
      totalUnsettledCommission: commission.totalOutstanding,
      walletsNearExhaustion,
      failedPurchaseCount,
      totalWallets: wallets.length,
      exhaustionRiskRate:
        wallets.length > 0 ? roundMoney((walletsNearExhaustion / wallets.length) * 100) : 0,
      phase: "phase-5",
    };
  },

  listSettlementBatches() {
    const rows = [...getWalletDomainState().settlementBatches].sort((left, right) =>
      right.businessDate.localeCompare(left.businessDate),
    );

    return {
      rows,
      total: rows.length,
    };
  },

  getSettlementBatch(settlementRef: string) {
    return (
      getWalletDomainState().settlementBatches.find(
        (batch) => batch.id === settlementRef || batch.businessDate === settlementRef,
      ) ?? null
    );
  },
};

export function getWalletSettlementService() {
  return walletSettlementService;
}
