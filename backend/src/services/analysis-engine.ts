import { randomUUID } from "node:crypto";
import cron from "node-cron";
import {
  extractRows,
  readNumber,
  readString,
  type ReportRow,
} from "../lib/upstream-data.js";
import { env as config } from "./env.js";
import { buildUpstreamRequestPlan } from "./upstream-request-adapters.js";
import {
  loadRuntimeState,
  saveRuntimeState,
  type AnalysisNotificationRecord,
  type AnalysisStateSnapshot,
} from "./runtime-state-store.js";
import { SchedulerLeader, type SchedulerLeaderStatus } from "./scheduler-leader.js";
import { theftIntelligenceService } from "./theft-intelligence.js";
import { forwardToUpstream, loginToUpstream } from "./upstream.js";

type NotificationItem = AnalysisNotificationRecord;

export interface ManagedEngineStatus {
  name: string;
  enabledByConfig: boolean;
  schedulerRunning: boolean;
  leader: SchedulerLeaderStatus;
  lastRunStartedAt: string | null;
  lastRunCompletedAt: string | null;
  lastRunDurationMs: number | null;
  lastError: string | null;
  theftMetrics?: {
    activeSignals: number;
    openCases: number;
    criticalSignals: number;
  };
}

function buildAlertKey(prefix: string, meterId: string, dateBucket: string) {
  return `${prefix}:${meterId}:${dateBucket}`;
}

function getMeterId(row: ReportRow) {
  return (
    readString(row, ["meterId", "meterNo", "meterNumber", "meterCode"]) ??
    "unknown-meter"
  );
}

function getCustomerLabel(row: ReportRow) {
  return (
    readString(row, ["customerName", "customer", "name", "userName"]) ??
    "Unknown customer"
  );
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getReportWindow(today = new Date()) {
  return {
    fromDate: `${today.getUTCFullYear()}-01-01`,
    toDate: formatIsoDate(today),
  };
}

function extractTotal(result: unknown): number | null {
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    return null;
  }

  const root = result as Record<string, unknown>;
  const page =
    typeof root.page === "object" && root.page !== null && !Array.isArray(root.page)
      ? (root.page as Record<string, unknown>)
      : null;

  for (const source of [root, page]) {
    if (!source) {
      continue;
    }

    for (const key of ["total", "count", "totalCount", "recordsTotal", "rowCount", "size"]) {
      const value = source[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        return Math.max(0, Math.floor(value));
      }

      if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return Math.max(0, Math.floor(parsed));
        }
      }
    }
  }

  return null;
}

const persistedState = await loadRuntimeState<AnalysisStateSnapshot>("analysis");

class AnalysisEngine {
  private cronJob: cron.ScheduledTask | null = null;
  private schedulerRunning = false;
  private readonly leader = new SchedulerLeader("analysis-engine", {
    onLeadershipAcquired: () => {
      this.ensureCronSchedule();
      this.scheduleImmediateRun(5_000);
    },
    onLeadershipLost: () => {
      this.stopCronSchedule();
    },
  });
  private knownAlerts = new Set<string>(persistedState?.knownAlerts ?? []);
  public notifications: NotificationItem[] = persistedState?.notifications ?? [];
  private lastRunStartedAt: string | null = null;
  private lastRunCompletedAt: string | null = null;
  private lastRunDurationMs: number | null = null;
  private lastError: string | null = null;

  private async persistState() {
    await saveRuntimeState("analysis", {
      notifications: this.notifications,
      knownAlerts: Array.from(this.knownAlerts),
      savedAt: new Date().toISOString(),
    });
  }

  private async getUpstreamAuth() {
    if (!config.upstreamPassword.trim()) {
      console.warn("[AnalysisEngine] Skipping analysis cycle because UPSTREAM_PASSWORD is empty.");
      return null;
    }

    try {
      const login = await loginToUpstream({
        username: config.upstreamUsername.trim(),
        password: config.upstreamPassword.trim(),
      });

      const authenticated =
        login.statusCode < 400 &&
        login.payload.code === 0 &&
        typeof login.upstreamCookie === "string";

      return authenticated ? login.upstreamCookie : null;
    } catch (error) {
      console.error("[AnalysisEngine] Failed to authenticate with upstream", error);
      return null;
    }
  }

  private async fetchUpstreamReport(
    authToken: string,
    endpoint: string,
    payload: Record<string, unknown>,
  ) {
    try {
      const rows: ReportRow[] = [];
      let total: number | null = null;
      let pageNumber = 1;

      while (pageNumber <= 100) {
        const requestPlan = buildUpstreamRequestPlan(endpoint, {
          ...payload,
          pageNumber,
          pageSize: 500,
          page: pageNumber,
          limit: 500,
        });
        const [firstCandidate, ...fallbackCandidates] = requestPlan.candidateBodies;

        let upstreamResult = await forwardToUpstream(
          endpoint,
          firstCandidate ?? requestPlan.body,
          authToken,
          { timeoutMs: requestPlan.timeoutMs },
        );

        for (const candidateBody of fallbackCandidates) {
          if (upstreamResult.statusCode < 400 && upstreamResult.payload.code === 0) {
            break;
          }

          upstreamResult = await forwardToUpstream(
            endpoint,
            candidateBody,
            authToken,
            { timeoutMs: requestPlan.timeoutMs },
          );
        }

        if (upstreamResult.statusCode >= 400 || upstreamResult.payload.code !== 0) {
          return rows;
        }

        const pageRows = extractRows(upstreamResult.payload.result);
        total = total ?? extractTotal(upstreamResult.payload.result);

        if (pageRows.length === 0) {
          break;
        }

        rows.push(...pageRows);

        if (total !== null && rows.length >= total) {
          break;
        }

        if (pageRows.length < 500) {
          break;
        }

        pageNumber += 1;
      }

      return rows;
    } catch (error) {
      console.error(`[AnalysisEngine] Failed to fetch report ${endpoint}`, error);
      return [];
    }
  }

  public async runAnalysisCycle() {
    const startedAt = Date.now();
    this.lastRunStartedAt = new Date(startedAt).toISOString();
    this.lastError = null;
    console.log("[AnalysisEngine] Starting scheduled analysis cycle...");
    const authToken = await this.getUpstreamAuth();

    if (!authToken) {
      this.lastError = "Upstream authentication failed";
      console.error("[AnalysisEngine] Aborting cycle because upstream authentication failed.");
      return;
    }

    let stateChanged = false;
    const dateBucket = new Date().toISOString().slice(0, 10);
    const reportWindow = getReportWindow();

    const lowPurchaseData = await this.fetchUpstreamReport(
      authToken,
      "/API/PrepayReport/LowPurchaseSituation",
      {
        ...reportWindow,
        lowLimit: 500,
      },
    );
    for (const row of lowPurchaseData) {
      const meterId = getMeterId(row);
      const customerLabel = getCustomerLabel(row);
      const remainingBalance = readNumber(row, [
        "remainingBalance",
        "balance",
        "remainBalance",
        "surplusAmount",
      ]);
      const alertKey = buildAlertKey("low-balance", meterId, dateBucket);

      if (
        remainingBalance !== undefined &&
        remainingBalance < 500 &&
        !this.knownAlerts.has(alertKey)
      ) {
        this.addNotification({
          type: "warning",
          title: "Low Balance Alert",
          message: `Meter ${meterId} (${customerLabel}) is below the balance threshold (${remainingBalance}).`,
          meterId,
        });
        this.knownAlerts.add(alertKey);
        stateChanged = true;
      }
    }

    const longNonPurchaseData = await this.fetchUpstreamReport(
      authToken,
      "/API/PrepayReport/LongNonpurchaseSituation",
      {
        ...reportWindow,
        nonpurchaseDaysStart: 30,
        nonpurchaseDaysEnd: 90,
      },
    );
    for (const row of longNonPurchaseData) {
      const meterId = getMeterId(row);
      const customerLabel = getCustomerLabel(row);
      const inactiveDays = readNumber(row, [
        "daysWithoutPurchase",
        "nonpurchaseDays",
        "noPurchaseDays",
        "inactiveDays",
        "days",
      ]);
      const alertKey = buildAlertKey("inactive-meter", meterId, dateBucket);

      if (
        inactiveDays !== undefined &&
        inactiveDays >= 30 &&
        !this.knownAlerts.has(alertKey)
      ) {
        this.addNotification({
          type: "critical",
          title: "Meter Offline Warning",
          message: `Meter ${meterId} (${customerLabel}) has been inactive for ${inactiveDays} days.`,
          meterId,
        });
        this.knownAlerts.add(alertKey);
        stateChanged = true;
      }
    }

    await theftIntelligenceService.ingestSignalsFromReports({
      dateBucket,
      lowPurchaseRows: lowPurchaseData,
      longNonPurchaseRows: longNonPurchaseData,
    });

    if (this.knownAlerts.size > 5000) {
      this.knownAlerts.clear();
      stateChanged = true;
    }

    if (stateChanged) {
      await this.persistState();
    }

    this.lastRunCompletedAt = new Date().toISOString();
    this.lastRunDurationMs = Date.now() - startedAt;

    console.log(
      `[AnalysisEngine] Cycle complete. Active notifications: ${this.notifications.filter((notification) => !notification.read).length}`,
    );
  }

  private addNotification(data: Omit<NotificationItem, "id" | "timestamp" | "read">) {
    const notification: NotificationItem = {
      ...data,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      read: false,
    };

    this.notifications.unshift(notification);

    if (this.notifications.length > 500) {
      this.notifications.pop();
    }
  }

  public getUnreadNotifications() {
    return this.notifications.filter((notification) => !notification.read);
  }

  public dismissNotifications(ids: string[]) {
    const idSet = new Set(ids);
    let dismissedCount = 0;

    for (const notification of this.notifications) {
      if (idSet.has(notification.id) && !notification.read) {
        notification.read = true;
        dismissedCount++;
      }
    }

    if (dismissedCount > 0) {
      void this.persistState();
    }

    return dismissedCount;
  }

  public dismissAllNotifications() {
    let dismissedCount = 0;

    for (const notification of this.notifications) {
      if (!notification.read) {
        notification.read = true;
        dismissedCount++;
      }
    }

    if (dismissedCount > 0) {
      void this.persistState();
    }

    return dismissedCount;
  }

  public start() {
    if (this.schedulerRunning) {
      return;
    }

    this.schedulerRunning = true;
    this.leader.start();
    if (config.nodeEnv !== "test") {
      console.log("[AnalysisEngine] Background service initialized (15m schedule).");
    }
  }

  public async stop() {
    if (!this.schedulerRunning) {
      return;
    }

    this.schedulerRunning = false;
    this.stopCronSchedule();
    await this.leader.stop();
  }

  public getStatus(): ManagedEngineStatus {
    const signals = theftIntelligenceService.listSignals();
    const cases = theftIntelligenceService.listCases();
    return {
      name: "analysis-engine",
      enabledByConfig: config.enableAnalysisEngine,
      schedulerRunning: this.schedulerRunning,
      leader: this.leader.getStatus(),
      lastRunStartedAt: this.lastRunStartedAt,
      lastRunCompletedAt: this.lastRunCompletedAt,
      lastRunDurationMs: this.lastRunDurationMs,
      lastError: this.lastError,
      theftMetrics: {
        activeSignals: signals.filter((item) => item.status === "active").length,
        openCases: cases.filter((item) =>
          ["new", "active", "investigating"].includes(item.status),
        ).length,
        criticalSignals: signals.filter(
          (item) => item.status === "active" && item.severity === "critical",
        ).length,
      },
    };
  }

  public async runNow() {
    if (!this.leader.currentlyLeads()) {
      return {
        accepted: false,
        reason: "This replica is not the active leader for analysis-engine.",
      };
    }

    await this.runAnalysisCycle();
    return {
      accepted: true,
      reason: "Analysis cycle completed on the active leader.",
    };
  }

  private ensureCronSchedule() {
    if (this.cronJob) {
      return;
    }

    this.cronJob = cron.schedule("*/15 * * * *", () => {
      void this.runAnalysisCycle();
    });
  }

  private stopCronSchedule() {
    if (!this.cronJob) {
      return;
    }

    this.cronJob.stop();
    this.cronJob = null;
  }

  private scheduleImmediateRun(delayMs: number) {
    setTimeout(() => {
      if (this.schedulerRunning && this.leader.currentlyLeads()) {
        void this.runAnalysisCycle();
      }
    }, delayMs);
  }
}

export const analysisEngine = new AnalysisEngine();
