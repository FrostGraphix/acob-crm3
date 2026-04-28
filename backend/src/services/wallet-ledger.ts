import { randomUUID } from "node:crypto";
import { isSupabaseDbEnabled } from "./supabase-db.js";
import { persistLedgerJournal, persistWallet } from "./wallet-persistence.js";
import {
  getWalletDomainState,
  nowIso,
  roundMoney,
  type LedgerDirection,
  type LedgerJournalRecord,
  type VendorWallet,
} from "./wallet-domain-store.js";

export interface WalletStatementRow {
  journalId: string;
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  journalType: string;
}

export interface WalletDataSourceDescriptor {
  mode: "in-memory-scaffold" | "supabase-configured-scaffold";
  tables: string[];
}

export interface WalletProvisioningInput {
  vendorId: string;
  siteCode: string;
  createdBy: string;
  creditLimit?: number;
}

export interface WalletLedgerPostingInput {
  walletId: string;
  vendorId: string;
  siteCode: string;
  amount: number;
  reference: string;
  postedBy: string;
  metadata?: Record<string, unknown>;
}

export interface WalletManualAdjustmentInput extends WalletLedgerPostingInput {
  direction: "credit" | "debit";
}

function buildDataSourceDescriptor(): WalletDataSourceDescriptor {
  return {
    mode: isSupabaseDbEnabled() ? "supabase-configured-scaffold" : "in-memory-scaffold",
    tables: [
      "vendor_wallets",
      "ledger_journals",
      "ledger_entries",
      "wallet_purchase_orders",
      "wallet_funding_requests",
      "wallet_receipts",
      "vendor_commission_rules",
    ],
  };
}

function createEntry(
  journalId: string,
  walletId: string,
  vendorId: string,
  siteCode: string,
  accountCode: string,
  direction: LedgerDirection,
  amount: number,
  reference: string,
  description: string,
  metadata: Record<string, unknown>,
) {
  return {
    id: randomUUID(),
    journalId,
    walletId,
    vendorId,
    siteCode,
    accountCode,
    direction,
    amount: roundMoney(amount),
    description,
    reference,
    createdAt: nowIso(),
    metadata,
  };
}

function createJournal(
  input: WalletLedgerPostingInput & {
    journalType: LedgerJournalRecord["journalType"];
    entryPairs: Array<{
      accountCode: string;
      direction: LedgerDirection;
      amount: number;
      description: string;
    }>;
  },
) {
  const state = getWalletDomainState();
  const journalId = randomUUID();
  const metadata = {
    ...(input.metadata ?? {}),
    dataSource: buildDataSourceDescriptor(),
  };
  const journal: LedgerJournalRecord = {
    id: journalId,
    walletId: input.walletId,
    vendorId: input.vendorId,
    siteCode: input.siteCode,
    journalType: input.journalType,
    reference: input.reference,
    status: "posted",
    postedBy: input.postedBy,
    amount: roundMoney(input.amount),
    createdAt: nowIso(),
    metadata,
    entries: input.entryPairs.map((entry) =>
      createEntry(
        journalId,
        input.walletId,
        input.vendorId,
        input.siteCode,
        entry.accountCode,
        entry.direction,
        entry.amount,
        input.reference,
        entry.description,
        metadata,
      ),
    ),
  };

  state.ledgerJournals.set(journal.id, journal);
  return journal;
}

function requireWallet(walletId: string) {
  const wallet = getWalletDomainState().wallets.get(walletId);
  if (!wallet) {
    throw new Error(`Wallet ${walletId} was not found`);
  }

  return wallet;
}

function updateWallet(wallet: VendorWallet, mutate: (current: VendorWallet) => void) {
  mutate(wallet);
  wallet.availableBalance = roundMoney(wallet.availableBalance);
  wallet.reservedBalance = roundMoney(wallet.reservedBalance);
  wallet.totalFunded = roundMoney(wallet.totalFunded);
  wallet.totalPurchased = roundMoney(wallet.totalPurchased);
  wallet.totalCommissionAccrued = roundMoney(wallet.totalCommissionAccrued);
  wallet.totalCommissionSettled = roundMoney(wallet.totalCommissionSettled);
  wallet.updatedAt = nowIso();
  getWalletDomainState().wallets.set(wallet.id, wallet);
  persistWallet(wallet);
  return wallet;
}

function buildStatementRows(walletId: string): WalletStatementRow[] {
  const journals = Array.from(getWalletDomainState().ledgerJournals.values())
    .filter((journal) => journal.walletId === walletId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  let runningBalance = 0;

  return journals
    .filter((journal) =>
      ["funding", "purchase", "release", "settlement", "commission-accrual", "manual-adjustment"].includes(
        journal.journalType,
      ),
    )
    .map((journal) => {
      const creditAmount = journal.entries
        .filter((entry) => entry.accountCode === "vendor_float" && entry.direction === "credit")
        .reduce((sum, entry) => sum + entry.amount, 0);
      const debitAmount = journal.entries
        .filter((entry) => entry.accountCode === "vendor_float" && entry.direction === "debit")
        .reduce((sum, entry) => sum + entry.amount, 0);

      runningBalance = roundMoney(runningBalance + creditAmount - debitAmount);

      return {
        journalId: journal.id,
        date: journal.createdAt,
        reference: journal.reference,
        description: String(journal.metadata.description ?? journal.journalType),
        debit: roundMoney(debitAmount),
        credit: roundMoney(creditAmount),
        balanceAfter: runningBalance,
        journalType: journal.journalType,
      };
    });
}

export const walletLedgerService = {
  describeDataSource() {
    return buildDataSourceDescriptor();
  },

  provisionWallet(input: WalletProvisioningInput) {
    const state = getWalletDomainState();
    const existing = Array.from(state.wallets.values()).find(
      (wallet) => wallet.vendorId === input.vendorId,
    );

    if (existing) {
      return existing;
    }

    const now = nowIso();
    const wallet: VendorWallet = {
      id: randomUUID(),
      vendorId: input.vendorId,
      siteCode: input.siteCode,
      currency: "NGN",
      status: "active",
      availableBalance: 0,
      reservedBalance: 0,
      totalFunded: 0,
      totalPurchased: 0,
      totalCommissionAccrued: 0,
      totalCommissionSettled: 0,
      creditLimit: roundMoney(input.creditLimit ?? 0),
      frozenReason: null,
      createdAt: now,
      updatedAt: now,
    };

    state.wallets.set(wallet.id, wallet);
    persistWallet(wallet);
    return wallet;
  },

  getWalletById(walletId: string) {
    return getWalletDomainState().wallets.get(walletId) ?? null;
  },

  getWalletByVendorId(vendorId: string) {
    return (
      Array.from(getWalletDomainState().wallets.values()).find((wallet) => wallet.vendorId === vendorId) ??
      null
    );
  },

  reserveFunds(input: WalletLedgerPostingInput) {
    const wallet = requireWallet(input.walletId);
    if (wallet.availableBalance < input.amount) {
      throw new Error("Insufficient wallet balance for reservation");
    }

    const journal = createJournal({
      ...input,
      journalType: "reserve",
      entryPairs: [
        {
          accountCode: "vendor_float",
          direction: "debit",
          amount: input.amount,
          description: "Reserve wallet balance before upstream vending",
        },
        {
          accountCode: "wallet_reserved",
          direction: "credit",
          amount: input.amount,
          description: "Hold vendor funds until upstream outcome is known",
        },
      ],
    });

      updateWallet(wallet, (current) => {
        current.availableBalance -= input.amount;
        current.reservedBalance += input.amount;
      });
      persistLedgerJournal(journal);

      return {
        wallet,
      journal,
      dataSource: buildDataSourceDescriptor(),
    };
  },

  releaseReservedFunds(input: WalletLedgerPostingInput) {
    const wallet = requireWallet(input.walletId);
    const journal = createJournal({
      ...input,
      journalType: "release",
      entryPairs: [
        {
          accountCode: "wallet_reserved",
          direction: "debit",
          amount: input.amount,
          description: "Release reserved wallet funds",
        },
        {
          accountCode: "vendor_float",
          direction: "credit",
          amount: input.amount,
          description: "Return released funds back to vendor float",
        },
      ],
    });

      updateWallet(wallet, (current) => {
        current.availableBalance += input.amount;
        current.reservedBalance = Math.max(0, current.reservedBalance - input.amount);
      });
      persistLedgerJournal(journal);

      return {
        wallet,
      journal,
      dataSource: buildDataSourceDescriptor(),
    };
  },

  postFundingCredit(input: WalletLedgerPostingInput) {
    const wallet = requireWallet(input.walletId);
    const journal = createJournal({
      ...input,
      journalType: "funding",
      entryPairs: [
        {
          accountCode: "platform_cash_clearing",
          direction: "debit",
          amount: input.amount,
          description: "Recognise incoming settlement cash pending wallet credit",
        },
        {
          accountCode: "vendor_float",
          direction: "credit",
          amount: input.amount,
          description: "Credit vendor float after funding approval",
        },
      ],
    });

      updateWallet(wallet, (current) => {
        current.availableBalance += input.amount;
        current.totalFunded += input.amount;
      });
      persistLedgerJournal(journal);

      return {
        wallet,
      journal,
      dataSource: buildDataSourceDescriptor(),
    };
  },

  postPurchaseSettlement(input: WalletLedgerPostingInput) {
    const wallet = requireWallet(input.walletId);
    const journal = createJournal({
      ...input,
      journalType: "purchase",
      entryPairs: [
        {
          accountCode: "wallet_reserved",
          direction: "debit",
          amount: input.amount,
          description: "Release reserved funds into purchase settlement",
        },
        {
          accountCode: "platform_energy_sales_clearing",
          direction: "credit",
          amount: input.amount,
          description: "Recognise vend settlement against reserved balance",
        },
      ],
    });

      updateWallet(wallet, (current) => {
        current.reservedBalance = Math.max(0, current.reservedBalance - input.amount);
        current.totalPurchased += input.amount;
      });
      persistLedgerJournal(journal);

      return {
        wallet,
      journal,
      dataSource: buildDataSourceDescriptor(),
    };
  },

  postCommissionAccrual(input: WalletLedgerPostingInput) {
    const wallet = requireWallet(input.walletId);
    const journal = createJournal({
      ...input,
      journalType: "commission-accrual",
      entryPairs: [
        {
          accountCode: "platform_commission_expense",
          direction: "debit",
          amount: input.amount,
          description: "Accrue vendor commission expense",
        },
        {
          accountCode: "vendor_commission_payable",
          direction: "credit",
          amount: input.amount,
          description: "Accrue vendor commission payable",
        },
      ],
    });

      updateWallet(wallet, (current) => {
        current.totalCommissionAccrued += input.amount;
      });
      persistLedgerJournal(journal);

      return {
        wallet,
      journal,
      dataSource: buildDataSourceDescriptor(),
    };
  },

  postSettlementCredit(input: WalletLedgerPostingInput) {
    const wallet = requireWallet(input.walletId);
    const journal = createJournal({
      ...input,
      journalType: "settlement",
      entryPairs: [
        {
          accountCode: "vendor_commission_payable",
          direction: "debit",
          amount: input.amount,
          description: "Release accrued commission into wallet float",
        },
        {
          accountCode: "vendor_float",
          direction: "credit",
          amount: input.amount,
          description: "Credit vendor wallet with settled commission",
        },
      ],
    });

      updateWallet(wallet, (current) => {
        current.availableBalance += input.amount;
        current.totalCommissionSettled += input.amount;
      });
      persistLedgerJournal(journal);

      return {
        wallet,
      journal,
      dataSource: buildDataSourceDescriptor(),
    };
  },

  postManualAdjustment(input: WalletManualAdjustmentInput) {
    const wallet = requireWallet(input.walletId);
    const vendorFloatDirection: LedgerDirection =
      input.direction === "credit" ? "credit" : "debit";
    const suspenseDirection: LedgerDirection =
      vendorFloatDirection === "credit" ? "debit" : "credit";
    const journal = createJournal({
      ...input,
      journalType: "manual-adjustment",
      entryPairs: [
        {
          accountCode: "wallet_adjustment_suspense",
          direction: suspenseDirection,
          amount: input.amount,
          description: "Offset manual adjustment suspense entry",
        },
        {
          accountCode: "vendor_float",
          direction: vendorFloatDirection,
          amount: input.amount,
          description: "Manual vendor wallet adjustment",
        },
      ],
    });

      updateWallet(wallet, (current) => {
        current.availableBalance += input.direction === "credit" ? input.amount : -input.amount;
      });
      persistLedgerJournal(journal);

      return {
        wallet,
      journal,
      dataSource: buildDataSourceDescriptor(),
    };
  },

  updateCreditLimit(walletId: string, creditLimit: number) {
    const wallet = requireWallet(walletId);
    return updateWallet(wallet, (current) => {
      current.creditLimit = roundMoney(creditLimit);
    });
  },

  buildWalletOverview(walletId: string) {
    const wallet = requireWallet(walletId);
    return {
      wallet,
      statementCount: buildStatementRows(walletId).length,
      dataSource: buildDataSourceDescriptor(),
    };
  },

  buildStatement(walletId: string, options: { fromDate?: string; toDate?: string } = {}) {
    const rows = buildStatementRows(walletId).filter((row) => {
      const rowDate = row.date.slice(0, 10);
      if (options.fromDate && rowDate < options.fromDate) {
        return false;
      }
      if (options.toDate && rowDate > options.toDate) {
        return false;
      }
      return true;
    });

    return {
      rows,
      total: rows.length,
      dataSource: buildDataSourceDescriptor(),
    };
  },
};

export function getWalletLedgerService() {
  return walletLedgerService;
}
