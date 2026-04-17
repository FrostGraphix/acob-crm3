import { randomUUID } from "node:crypto";
import { getWalletAlertsService } from "./wallet-alerts.js";
import {
  persistReconciliationException,
  persistReconciliationRun,
} from "./wallet-persistence.js";
import { getWalletSettlementService } from "./wallet-settlement.js";
import {
  getWalletDomainState,
  nowIso,
  roundMoney,
  type ReconciliationExceptionRecord,
  type ReconciliationStageSummary,
  type WalletRequestContext,
} from "./wallet-domain-store.js";

interface WalletReconciliationStatus {
  name: "wallet-reconciliation-engine";
  enabledByConfig: true;
  schedulerRunning: boolean;
  lastRunStartedAt: string | null;
  lastRunCompletedAt: string | null;
  lastError: string | null;
  intervalMinutes: number;
}

interface WalletReconciliationSummaryRow {
  businessDate: string;
  totalRuns: number;
  totalExceptions: number;
  openExceptions: number;
  resolvedExceptions: number;
  escalatedExceptions: number;
  criticalExceptions: number;
  oldestOpenAt: string | null;
  lastRunCompletedAt: string | null;
  stageSummary: string;
  lockedReportCount: number;
}

interface SettlementReportRow {
  siteCode: string;
  totalFundingPosted: number;
  totalPurchases: number;
  totalReversals: number;
  totalCommissionAccrued: number;
  closingTotalFloat: number;
  vendorCount: number;
  purchaseCount: number;
  exceptionCount: number;
}

let reconciliationStatus: WalletReconciliationStatus = {
  name: "wallet-reconciliation-engine",
  enabledByConfig: true,
  schedulerRunning: false,
  lastRunStartedAt: null,
  lastRunCompletedAt: null,
  lastError: null,
  intervalMinutes: 10,
};

let runInFlight = false;

function currentBusinessDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
  }).format(new Date());
}

function isFinanceRole(context: WalletRequestContext) {
  return context.appRole === "super_admin" || context.appRole === "admin" || context.appRole === "finance";
}

function canManageExceptions(context: WalletRequestContext) {
  return isFinanceRole(context) || context.appRole === "ops_manager";
}

function updateSchedulerRunning(schedulerRunning: boolean) {
  reconciliationStatus = {
    ...reconciliationStatus,
    schedulerRunning,
  };
}

function existingOpenException(match: Partial<ReconciliationExceptionRecord>) {
  return Array.from(getWalletDomainState().reconciliationExceptions.values()).find((entry) => {
    if (entry.status === "resolved") {
      return false;
    }

    return Object.entries(match).every(([key, value]) => {
      return entry[key as keyof ReconciliationExceptionRecord] === value;
    });
  });
}

function addException(
  input: Pick<
    ReconciliationExceptionRecord,
    | "type"
    | "severity"
    | "siteCode"
    | "vendorId"
    | "walletId"
    | "purchaseOrderId"
    | "fundingRequestId"
    | "summary"
    | "details"
  > & {
    dueInMinutes?: number;
  },
) {
  const existing = existingOpenException({
    type: input.type,
    walletId: input.walletId,
    purchaseOrderId: input.purchaseOrderId,
    fundingRequestId: input.fundingRequestId,
    siteCode: input.siteCode,
  });
  if (existing) {
    existing.details = {
      ...existing.details,
      ...input.details,
    };
    persistReconciliationException(existing);
    return existing;
  }

  const record: ReconciliationExceptionRecord = {
    id: randomUUID(),
    type: input.type,
    severity: input.severity,
    status: "open",
    siteCode: input.siteCode,
    vendorId: input.vendorId,
    walletId: input.walletId,
    purchaseOrderId: input.purchaseOrderId,
    fundingRequestId: input.fundingRequestId,
    summary: input.summary,
    details: input.details,
    detectedAt: nowIso(),
    dueAt: new Date(Date.now() + (input.dueInMinutes ?? 60) * 60_000).toISOString(),
    assignee: null,
    escalatedAt: null,
    escalationReason: null,
    resolutionCode: null,
    resolutionNotes: null,
    resolvedAt: null,
    resolvedBy: null,
  };

  getWalletDomainState().reconciliationExceptions.set(record.id, record);
  persistReconciliationException(record);
  return record;
}

function syncEscalations() {
  for (const record of getWalletDomainState().reconciliationExceptions.values()) {
    if (record.status === "resolved") {
      continue;
    }
    if (record.escalatedAt || record.dueAt > nowIso()) {
      continue;
    }

    record.status = "escalated";
    record.escalatedAt = nowIso();
    record.escalationReason = "SLA_BREACHED";
    getWalletDomainState().reconciliationExceptions.set(record.id, record);
    persistReconciliationException(record);
    getWalletAlertsService().emit({
      category: "exception_escalated",
      severity: record.severity === "critical" ? "critical" : "warning",
      title: "Wallet Exception Escalated",
      message: `${record.summary} was escalated automatically after breaching its SLA.`,
      source: "wallet-reconciliation",
      siteCode: record.siteCode,
      vendorId: record.vendorId,
      walletId: record.walletId,
      dedupeKey: `exception-escalated:${record.id}`,
      metadata: {
        exceptionId: record.id,
        escalationReason: record.escalationReason,
      },
    });
  }
}

function runLevelOneBalanceChecks() {
  let checked = 0;
  let exceptions = 0;

  for (const wallet of getWalletDomainState().wallets.values()) {
    checked += 1;
    const journals = Array.from(getWalletDomainState().ledgerJournals.values()).filter(
      (journal) => journal.walletId === wallet.id,
    );
    const derivedAvailable = roundMoney(
      journals
        .flatMap((journal) => journal.entries)
        .filter((entry) => entry.accountCode === "vendor_float")
        .reduce((sum, entry) => sum + (entry.direction === "credit" ? entry.amount : -entry.amount), 0),
    );
    const derivedReserved = roundMoney(
      journals
        .flatMap((journal) => journal.entries)
        .filter((entry) => entry.accountCode === "wallet_reserved")
        .reduce((sum, entry) => sum + (entry.direction === "credit" ? entry.amount : -entry.amount), 0),
    );

    if (
      derivedAvailable !== roundMoney(wallet.availableBalance) ||
      derivedReserved !== roundMoney(wallet.reservedBalance)
    ) {
      addException({
        type: "balance_drift",
        severity: "high",
        siteCode: wallet.siteCode,
        vendorId: wallet.vendorId,
        walletId: wallet.id,
        purchaseOrderId: null,
        fundingRequestId: null,
        summary: "Derived wallet balances do not match the current snapshot",
        details: {
          derivedAvailable,
          derivedReserved,
          snapshotAvailable: wallet.availableBalance,
          snapshotReserved: wallet.reservedBalance,
        },
      });
      exceptions += 1;
    }
  }

  return {
    level: "L1",
    checked,
    exceptions,
  } satisfies ReconciliationStageSummary;
}

function runLevelTwoPurchaseChecks() {
  let checked = 0;
  let exceptions = 0;

  for (const order of getWalletDomainState().purchaseOrders.values()) {
    checked += 1;
    const ageMinutes = Math.round((Date.now() - new Date(order.reservedAt).getTime()) / 60_000);

    if (order.status === "processing" && ageMinutes >= 15) {
      addException({
        type: "stuck_reservation",
        severity: "critical",
        siteCode: order.siteCode,
        vendorId: order.vendorId,
        walletId: order.walletId,
        purchaseOrderId: order.id,
        fundingRequestId: null,
        summary: "Reserved purchase has not completed within reconciliation SLA",
        details: {
          ageMinutes,
          idempotencyKey: order.idempotencyKey,
        },
        dueInMinutes: 15,
      });
      exceptions += 1;
    }

    if (
      order.status === "failed" &&
      order.failureCode === "LOCAL_FINALISATION_PENDING_RECONCILIATION"
    ) {
      addException({
        type: "upstream_success_local_fail",
        severity: "critical",
        siteCode: order.siteCode,
        vendorId: order.vendorId,
        walletId: order.walletId,
        purchaseOrderId: order.id,
        fundingRequestId: null,
        summary: "Upstream confirmed success while local finalisation remained incomplete",
        details: {
          idempotencyKey: order.idempotencyKey,
          failureReason: order.failureReason,
        },
        dueInMinutes: 15,
      });
      exceptions += 1;
    }

    if (order.status === "success" && !order.remoteSendRef && !order.tokenValue) {
      addException({
        type: "local_success_upstream_missing",
        severity: "high",
        siteCode: order.siteCode,
        vendorId: order.vendorId,
        walletId: order.walletId,
        purchaseOrderId: order.id,
        fundingRequestId: null,
        summary: "Successful purchase is missing upstream delivery evidence",
        details: {
          deliveryMethod: order.deliveryMethod,
          receiptRef: order.receiptRef,
        },
      });
      exceptions += 1;
    }
  }

  return {
    level: "L2",
    checked,
    exceptions,
  } satisfies ReconciliationStageSummary;
}

function runLevelThreeFundingChecks() {
  let checked = 0;
  let exceptions = 0;
  const journals = Array.from(getWalletDomainState().ledgerJournals.values()).filter(
    (journal) => journal.journalType === "funding",
  );

  for (const request of getWalletDomainState().fundingRequests.values()) {
    checked += 1;
    const linkedJournal = journals.find((journal) => journal.metadata.fundingRequestId === request.id);

    if (request.status === "posted" && !linkedJournal) {
      addException({
        type: "funding_unmatched",
        severity: "high",
        siteCode: request.siteCode,
        vendorId: request.vendorId,
        walletId: request.walletId,
        purchaseOrderId: null,
        fundingRequestId: request.id,
        summary: "Posted funding request is missing its funding ledger journal",
        details: {
          reference: request.reference,
          amount: request.amount,
        },
      });
      exceptions += 1;
    }

    if (linkedJournal && request.status !== "posted") {
      addException({
        type: "funding_confirmation_missing",
        severity: "high",
        siteCode: request.siteCode,
        vendorId: request.vendorId,
        walletId: request.walletId,
        purchaseOrderId: null,
        fundingRequestId: request.id,
        summary: "Funding journal exists but request status is not posted",
        details: {
          reference: request.reference,
          requestStatus: request.status,
          journalId: linkedJournal.id,
        },
      });
      exceptions += 1;
    }
  }

  for (const journal of journals) {
    checked += 1;
    const fundingRequestId =
      typeof journal.metadata.fundingRequestId === "string" ? journal.metadata.fundingRequestId : null;
    const linkedRequest = fundingRequestId
      ? getWalletDomainState().fundingRequests.get(fundingRequestId)
      : null;

    if (!linkedRequest || linkedRequest.status !== "posted") {
      addException({
        type: "funding_unmatched",
        severity: "high",
        siteCode: journal.siteCode,
        vendorId: journal.vendorId,
        walletId: journal.walletId,
        purchaseOrderId: null,
        fundingRequestId,
        summary: "Funding journal is missing a matching posted funding request",
        details: {
          journalId: journal.id,
          reference: journal.reference,
        },
      });
      exceptions += 1;
    }
  }

  return {
    level: "L3",
    checked,
    exceptions,
  } satisfies ReconciliationStageSummary;
}

function runLevelFourCommissionChecks(businessDate: string) {
  let checked = 0;
  let exceptions = 0;

  const successfulOrders = Array.from(getWalletDomainState().purchaseOrders.values()).filter(
    (order) => order.status === "success" && order.settledAt?.slice(0, 10) === businessDate,
  );
  const expectedCommission = roundMoney(
    successfulOrders.reduce((sum, order) => {
      const amount =
        typeof order.metadata.commissionAmount === "number" ? order.metadata.commissionAmount : 0;
      return sum + amount;
    }, 0),
  );
  const accruedCommission = roundMoney(
    Array.from(getWalletDomainState().ledgerJournals.values())
      .filter(
        (journal) =>
          journal.journalType === "commission-accrual" && journal.createdAt.slice(0, 10) === businessDate,
      )
      .reduce((sum, journal) => sum + journal.amount, 0),
  );

  checked = successfulOrders.length;
  if (expectedCommission !== accruedCommission) {
    addException({
      type: "commission_mismatch",
      severity: "medium",
      siteCode: successfulOrders[0]?.siteCode ?? "site_unassigned",
      vendorId: successfulOrders[0]?.vendorId ?? null,
      walletId: successfulOrders[0]?.walletId ?? null,
      purchaseOrderId: successfulOrders[0]?.id ?? null,
      fundingRequestId: null,
      summary: "Commission accrual journals do not reconcile to successful purchase commissions",
      details: {
        businessDate,
        expectedCommission,
        accruedCommission,
        purchaseCount: successfulOrders.length,
      },
    });
    exceptions += 1;
  }

  return {
    level: "L4",
    checked,
    exceptions,
  } satisfies ReconciliationStageSummary;
}

function buildSettlementReportRows(businessDate: string) {
  const siteMap = new Map<string, SettlementReportRow>();
  const ensureSiteRow = (siteCode: string) => {
    const normalizedSite = siteCode || "site_unassigned";
    const current = siteMap.get(normalizedSite) ?? {
      siteCode: normalizedSite,
      totalFundingPosted: 0,
      totalPurchases: 0,
      totalReversals: 0,
      totalCommissionAccrued: 0,
      closingTotalFloat: 0,
      vendorCount: 0,
      purchaseCount: 0,
      exceptionCount: 0,
    };
    siteMap.set(normalizedSite, current);
    return current;
  };

  for (const request of getWalletDomainState().fundingRequests.values()) {
    if (request.status !== "posted" || request.postedAt?.slice(0, 10) !== businessDate) {
      continue;
    }

    const bucket = ensureSiteRow(request.siteCode);
    bucket.totalFundingPosted = roundMoney(bucket.totalFundingPosted + request.amount);
  }

  for (const order of getWalletDomainState().purchaseOrders.values()) {
    if (order.status !== "success" || order.settledAt?.slice(0, 10) !== businessDate) {
      continue;
    }

    const bucket = ensureSiteRow(order.siteCode);
    bucket.totalPurchases = roundMoney(bucket.totalPurchases + order.amount);
    bucket.purchaseCount += 1;
  }

  for (const journal of getWalletDomainState().ledgerJournals.values()) {
    if (journal.createdAt.slice(0, 10) !== businessDate) {
      continue;
    }

    if (journal.journalType === "commission-accrual") {
      const bucket = ensureSiteRow(journal.siteCode);
      bucket.totalCommissionAccrued = roundMoney(bucket.totalCommissionAccrued + journal.amount);
    }
  }

  for (const wallet of getWalletDomainState().wallets.values()) {
    const bucket = ensureSiteRow(wallet.siteCode);
    bucket.closingTotalFloat = roundMoney(bucket.closingTotalFloat + wallet.availableBalance);
  }

  for (const vendor of getWalletDomainState().vendors.values()) {
    const bucket = ensureSiteRow(vendor.siteCode);
    bucket.vendorCount += 1;
  }

  for (const exception of getWalletDomainState().reconciliationExceptions.values()) {
    if (exception.detectedAt.slice(0, 10) !== businessDate) {
      continue;
    }

    const bucket = ensureSiteRow(exception.siteCode);
    bucket.exceptionCount += 1;
  }

  return Array.from(siteMap.values()).sort((left, right) => left.siteCode.localeCompare(right.siteCode));
}

function runLevelFiveSettlementChecks(businessDate: string) {
  let checked = 0;
  let exceptions = 0;
  const reportRows = buildSettlementReportRows(businessDate);
  const batches = getWalletDomainState().settlementBatches.filter(
    (batch) => batch.businessDate === businessDate && batch.status === "posted",
  );

  for (const batch of batches) {
    checked += 1;
    const reportTotalCommission = roundMoney(
      reportRows.reduce((sum, row) => sum + row.totalCommissionAccrued, 0),
    );
    if (roundMoney(batch.totalCommissionCredits) !== reportTotalCommission) {
      addException({
        type: "manual_review_required",
        severity: "high",
        siteCode: batch.siteBreakdown?.[0]?.siteCode ?? "site_unassigned",
        vendorId: null,
        walletId: null,
        purchaseOrderId: null,
        fundingRequestId: null,
        summary: "Settlement batch totals do not match the daily operational settlement report",
        details: {
          batchId: batch.id,
          businessDate,
          batchTotalCommissionCredits: batch.totalCommissionCredits,
          reportTotalCommission,
        },
      });
      exceptions += 1;
    }
  }

  return {
    level: "L5",
    checked,
    exceptions,
  } satisfies ReconciliationStageSummary;
}

function buildStageSummary(stageSummaries: ReconciliationStageSummary[]) {
  return stageSummaries
    .map((stage) => `${stage.level}:${stage.exceptions}/${stage.checked}`)
    .join(" | ");
}

function buildSummaryRows(businessDate: string) {
  const rowsForDate = getWalletDomainState().reconciliationRuns.filter(
    (run) => run.businessDate === businessDate,
  );
  const exceptionsForDate = Array.from(getWalletDomainState().reconciliationExceptions.values()).filter(
    (entry) => entry.detectedAt.slice(0, 10) === businessDate,
  );
  const openRows = exceptionsForDate
    .filter((entry) => entry.status !== "resolved")
    .sort((left, right) => left.detectedAt.localeCompare(right.detectedAt));
  const lastRun = rowsForDate[0] ?? null;

  return [
    {
      businessDate,
      totalRuns: rowsForDate.length,
      totalExceptions: exceptionsForDate.length,
      openExceptions: openRows.length,
      resolvedExceptions: exceptionsForDate.filter((entry) => entry.status === "resolved").length,
      escalatedExceptions: exceptionsForDate.filter((entry) => entry.status === "escalated").length,
      criticalExceptions: exceptionsForDate.filter((entry) => entry.severity === "critical").length,
      oldestOpenAt: openRows[0]?.detectedAt ?? null,
      lastRunCompletedAt: lastRun?.completedAt ?? null,
      stageSummary: lastRun ? buildStageSummary(lastRun.stageSummaries) : "",
      lockedReportCount: rowsForDate.filter((entry) => entry.reportLockedAt).length,
    } satisfies WalletReconciliationSummaryRow,
  ];
}

export const walletReconciliationService = {
  getStatus() {
    syncEscalations();
    return {
      ...reconciliationStatus,
      openExceptions: Array.from(getWalletDomainState().reconciliationExceptions.values()).filter(
        (entry) => entry.status !== "resolved",
      ).length,
    };
  },

  setSchedulerRunning: updateSchedulerRunning,

  buildSettlementReport(businessDate = currentBusinessDate()) {
    const rows = buildSettlementReportRows(businessDate);
    return {
      businessDate,
      rows,
      totalFundingPosted: roundMoney(rows.reduce((sum, row) => sum + row.totalFundingPosted, 0)),
      totalPurchases: roundMoney(rows.reduce((sum, row) => sum + row.totalPurchases, 0)),
      totalReversals: roundMoney(rows.reduce((sum, row) => sum + row.totalReversals, 0)),
      totalCommissionAccrued: roundMoney(
        rows.reduce((sum, row) => sum + row.totalCommissionAccrued, 0),
      ),
      closingTotalFloat: roundMoney(rows.reduce((sum, row) => sum + row.closingTotalFloat, 0)),
      vendorCount: rows.reduce((sum, row) => sum + row.vendorCount, 0),
      purchaseCount: rows.reduce((sum, row) => sum + row.purchaseCount, 0),
      exceptionCount: rows.reduce((sum, row) => sum + row.exceptionCount, 0),
    };
  },

  getSummary(context: WalletRequestContext, businessDate = currentBusinessDate()) {
    if (!canManageExceptions(context)) {
      throw new Error("Only finance, admin, or ops roles can view reconciliation summary");
    }

    syncEscalations();
    const rows = buildSummaryRows(businessDate);
    return {
      rows,
      total: rows.length,
      settlementReport: this.buildSettlementReport(businessDate),
    };
  },

  async runNow(context: WalletRequestContext, options: { dryRun?: boolean } = {}) {
    if (!isFinanceRole(context)) {
      throw new Error("Only finance or admin roles can run reconciliation");
    }

    if (runInFlight) {
      return {
        accepted: false,
        reason: "Wallet reconciliation run already in progress",
        status: this.getStatus(),
      };
    }

    runInFlight = true;
    reconciliationStatus = {
      ...reconciliationStatus,
      lastRunStartedAt: nowIso(),
      lastError: null,
    };

    try {
      syncEscalations();
      const businessDate = currentBusinessDate();
      const stageSummaries = [
        runLevelOneBalanceChecks(),
        runLevelTwoPurchaseChecks(),
        runLevelThreeFundingChecks(),
        runLevelFourCommissionChecks(businessDate),
        runLevelFiveSettlementChecks(businessDate),
      ];
      const completedAt = nowIso();
      const lockedReportExists = getWalletDomainState().reconciliationRuns.some(
        (run) => run.businessDate === businessDate && run.reportLockedAt,
      );

      const runRecord = {
        id: randomUUID(),
        triggeredBy: context.actorUserId,
        businessDate,
        status: "completed" as const,
        startedAt: reconciliationStatus.lastRunStartedAt ?? nowIso(),
        completedAt,
        stageSummaries,
        exceptionCount: stageSummaries.reduce((sum, stage) => sum + stage.exceptions, 0),
        dryRun: options.dryRun ?? false,
        reportLockedAt: options.dryRun || lockedReportExists ? null : completedAt,
      };
      getWalletDomainState().reconciliationRuns.unshift(runRecord);
      persistReconciliationRun(runRecord);
      reconciliationStatus = {
        ...reconciliationStatus,
        lastRunCompletedAt: runRecord.completedAt,
      };

      return {
        accepted: true,
        reason: "Wallet reconciliation completed",
        run: runRecord,
        summary: this.getSummary(context, businessDate),
        settlementReport: this.buildSettlementReport(businessDate),
        status: this.getStatus(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wallet reconciliation failed";
      reconciliationStatus = {
        ...reconciliationStatus,
        lastError: message,
      };
      throw error;
    } finally {
      runInFlight = false;
    }
  },

  listExceptions(
    context: WalletRequestContext,
    filters: { severity?: string; status?: string; searchTerm?: string } = {},
  ) {
    if (!canManageExceptions(context)) {
      throw new Error("Only finance, admin, or ops roles can view reconciliation exceptions");
    }

    syncEscalations();
    const search = (filters.searchTerm ?? "").trim().toLowerCase();
    const rows = Array.from(getWalletDomainState().reconciliationExceptions.values())
      .filter((entry) => {
        if (filters.severity && entry.severity !== filters.severity) {
          return false;
        }
        if (filters.status && entry.status !== filters.status) {
          return false;
        }
        if (context.appRole === "ops_manager" && context.siteCode) {
          return entry.siteCode === context.siteCode;
        }
        if (!search) {
          return true;
        }

        return (
          entry.summary.toLowerCase().includes(search) ||
          entry.type.toLowerCase().includes(search) ||
          entry.siteCode.toLowerCase().includes(search) ||
          (entry.assignee ?? "").toLowerCase().includes(search)
        );
      })
      .sort((left, right) => right.detectedAt.localeCompare(left.detectedAt));

    return {
      rows,
      total: rows.length,
    };
  },

  getExceptionDetail(context: WalletRequestContext, exceptionId: string) {
    if (!canManageExceptions(context)) {
      throw new Error("Only finance, admin, or ops roles can view reconciliation exceptions");
    }

    syncEscalations();
    const record = getWalletDomainState().reconciliationExceptions.get(exceptionId);
    if (!record) {
      throw new Error(`Exception ${exceptionId} was not found`);
    }

    return {
      ...record,
      purchaseOrder: record.purchaseOrderId
        ? getWalletDomainState().purchaseOrders.get(record.purchaseOrderId) ?? null
        : null,
      fundingRequest: record.fundingRequestId
        ? getWalletDomainState().fundingRequests.get(record.fundingRequestId) ?? null
        : null,
    };
  },

  assignException(context: WalletRequestContext, exceptionId: string, assignee: string) {
    if (!canManageExceptions(context)) {
      throw new Error("Only finance, admin, or ops roles can assign exceptions");
    }

    const record = getWalletDomainState().reconciliationExceptions.get(exceptionId);
    if (!record) {
      throw new Error(`Exception ${exceptionId} was not found`);
    }

    record.status = "assigned";
    record.assignee = assignee.trim();
    getWalletDomainState().reconciliationExceptions.set(record.id, record);
    persistReconciliationException(record);
    return record;
  },

  escalateException(context: WalletRequestContext, exceptionId: string, reason: string) {
    if (!canManageExceptions(context)) {
      throw new Error("Only finance, admin, or ops roles can escalate exceptions");
    }

    const record = getWalletDomainState().reconciliationExceptions.get(exceptionId);
    if (!record) {
      throw new Error(`Exception ${exceptionId} was not found`);
    }

    record.status = "escalated";
    record.escalatedAt = nowIso();
    record.escalationReason = reason.trim();
    getWalletDomainState().reconciliationExceptions.set(record.id, record);
    persistReconciliationException(record);
    getWalletAlertsService().emit({
      category: "exception_escalated",
      severity: record.severity === "critical" ? "critical" : "warning",
      title: "Wallet Exception Escalated",
      message: `${record.summary} was escalated for review: ${record.escalationReason}.`,
      source: "wallet-reconciliation",
      siteCode: record.siteCode,
      vendorId: record.vendorId,
      walletId: record.walletId,
      dedupeKey: `exception-escalated:${record.id}`,
      metadata: {
        exceptionId: record.id,
        escalationReason: record.escalationReason,
      },
    });
    return record;
  },

  resolveException(
    context: WalletRequestContext,
    exceptionId: string,
    resolutionCode: string,
    resolutionNotes: string,
  ) {
    if (!canManageExceptions(context)) {
      throw new Error("Only finance, admin, or ops roles can resolve exceptions");
    }

    const record = getWalletDomainState().reconciliationExceptions.get(exceptionId);
    if (!record) {
      throw new Error(`Exception ${exceptionId} was not found`);
    }

    record.status = "resolved";
    record.resolutionCode = resolutionCode.trim();
    record.resolutionNotes = resolutionNotes.trim();
    record.resolvedAt = nowIso();
    record.resolvedBy = context.actorUserId;
    getWalletDomainState().reconciliationExceptions.set(record.id, record);
    persistReconciliationException(record);
    return record;
  },

  getSettlementReport(context: WalletRequestContext, settlementRef = "latest") {
    if (!canManageExceptions(context)) {
      throw new Error("Only finance, admin, or ops roles can view settlement reports");
    }

    const batches = getWalletSettlementService().listSettlementBatches();
    const batch =
      settlementRef === "latest"
        ? batches.rows[0] ?? null
        : batches.rows.find(
            (entry) => entry.id === settlementRef || entry.businessDate === settlementRef,
          ) ?? null;
    const businessDate = batch?.businessDate ?? currentBusinessDate();

    return {
      batch,
      rows: this.buildSettlementReport(businessDate).rows,
      total: this.buildSettlementReport(businessDate).rows.length,
      report: this.buildSettlementReport(businessDate),
    };
  },
};

export function getWalletReconciliationService() {
  return walletReconciliationService;
}
