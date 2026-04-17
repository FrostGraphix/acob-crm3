import { getWalletLedgerService } from "./wallet-ledger.js";
import { persistCommissionRule } from "./wallet-persistence.js";
import {
  ensureCommissionRule,
  getWalletDomainState,
  roundMoney,
  type PurchaseOrderRecord,
  type WalletRequestContext,
} from "./wallet-domain-store.js";

export interface WalletCommissionAccrualResult {
  vendorId: string;
  walletId: string;
  rate: number;
  amount: number;
  zeroRate: boolean;
  journalId: string;
}

export interface WalletCommissionHistoryRow {
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

export const walletCommissionService = {
  getRule(vendorId: string) {
    return ensureCommissionRule(vendorId);
  },

  setRule(vendorId: string, rate: number) {
    const rule = ensureCommissionRule(vendorId);
    rule.rate = roundMoney(rate);
    rule.overrideSource = "vendor_override";
    rule.updatedAt = new Date().toISOString();
    getWalletDomainState().commissionRules.set(vendorId, rule);
    persistCommissionRule(vendorId, rule);
    return rule;
  },

  accruePurchaseCommission(context: WalletRequestContext, order: PurchaseOrderRecord) {
    const rule = ensureCommissionRule(order.vendorId);
    const amount = roundMoney(order.amount * rule.rate);
    const result = getWalletLedgerService().postCommissionAccrual({
      walletId: order.walletId,
      vendorId: order.vendorId,
      siteCode: order.siteCode,
      amount,
      reference: `COMM-${order.id}`,
      postedBy: context.actorUserId,
      metadata: {
        description: "Commission accrual generated from purchase",
        purchaseOrderId: order.id,
        commissionRate: rule.rate,
        zeroRate: amount === 0,
      },
    });

    return {
      vendorId: order.vendorId,
      walletId: order.walletId,
      rate: rule.rate,
      amount,
      zeroRate: amount === 0,
      journalId: result.journal.id,
    } satisfies WalletCommissionAccrualResult;
  },

  listOutstandingCommission(vendorId?: string) {
    const journals = Array.from(getWalletDomainState().ledgerJournals.values()).filter((journal) => {
      if (journal.journalType !== "commission-accrual") {
        return false;
      }

      return vendorId ? journal.vendorId === vendorId : true;
    });

    const totalAccrued = roundMoney(journals.reduce((sum, journal) => sum + journal.amount, 0));
    const settled = roundMoney(
      Array.from(getWalletDomainState().ledgerJournals.values())
        .filter((journal) => journal.journalType === "settlement")
        .filter((journal) => (vendorId ? journal.vendorId === vendorId : true))
        .reduce((sum, journal) => sum + journal.amount, 0),
    );

    return {
      totalAccrued,
      totalSettled: settled,
      totalOutstanding: roundMoney(totalAccrued - settled),
      count: journals.length,
    };
  },

  listRules() {
    const state = getWalletDomainState();
    const vendorIds = new Set<string>([
      ...Array.from(state.vendors.keys()),
      ...Array.from(state.commissionRules.keys()),
    ]);

    const rows = Array.from(vendorIds)
      .map((vendorId) => {
        const vendor = state.vendors.get(vendorId);
        const rule = ensureCommissionRule(vendorId);
        const outstanding = this.listOutstandingCommission(vendorId);
        return {
          vendorId,
          vendorCode: vendor?.vendorCode ?? vendorId,
          vendorName: vendor?.businessName ?? vendorId,
          siteCode: vendor?.siteCode ?? null,
          rate: rule.rate,
          overrideSource: rule.overrideSource,
          totalAccrued: outstanding.totalAccrued,
          totalSettled: outstanding.totalSettled,
          totalOutstanding: outstanding.totalOutstanding,
          updatedAt: rule.updatedAt,
        };
      })
      .sort((left, right) => left.vendorCode.localeCompare(right.vendorCode));

    return {
      rows,
      total: rows.length,
    };
  },

  listHistory(vendorId?: string) {
    const rows = Array.from(getWalletDomainState().ledgerJournals.values())
      .filter(
        (journal) =>
          journal.journalType === "commission-accrual" || journal.journalType === "settlement",
      )
      .filter((journal) => (vendorId ? journal.vendorId === vendorId : true))
      .map((journal) => ({
        id: journal.id,
        vendorId: journal.vendorId,
        walletId: journal.walletId,
        type: journal.journalType === "settlement" ? "settlement" : "accrual",
        amount: journal.amount,
        rate:
          typeof journal.metadata.commissionRate === "number"
            ? journal.metadata.commissionRate
            : null,
        purchaseOrderId:
          typeof journal.metadata.purchaseOrderId === "string"
            ? journal.metadata.purchaseOrderId
            : null,
        businessDate:
          typeof journal.metadata.businessDate === "string" ? journal.metadata.businessDate : null,
        reference: journal.reference,
        createdAt: journal.createdAt,
      } satisfies WalletCommissionHistoryRow))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return {
      rows,
      total: rows.length,
    };
  },

  buildVendorSummary(vendorId: string) {
    const rule = ensureCommissionRule(vendorId);
    const outstanding = this.listOutstandingCommission(vendorId);
    const history = this.listHistory(vendorId);

    return {
      rule,
      totalAccrued: outstanding.totalAccrued,
      totalSettled: outstanding.totalSettled,
      totalOutstanding: outstanding.totalOutstanding,
      accrualCount: history.rows.filter((row) => row.type === "accrual").length,
      settlementCount: history.rows.filter((row) => row.type === "settlement").length,
      latestAccruedAt:
        history.rows.find((row) => row.type === "accrual")?.createdAt ?? null,
      latestSettledAt:
        history.rows.find((row) => row.type === "settlement")?.createdAt ?? null,
      history,
    };
  },
};

export function getWalletCommissionService() {
  return walletCommissionService;
}
