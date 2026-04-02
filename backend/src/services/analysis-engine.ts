import { randomUUID } from "node:crypto";
import cron from "node-cron";
import {
  extractRows,
  readNumber,
  readString,
  type ReportRow,
} from "../lib/upstream-data.js";
import { env as config } from "./env.js";
import {
  loadRuntimeState,
  saveRuntimeState,
  type AnalysisNotificationRecord,
  type AnalysisStateSnapshot,
} from "./runtime-state-store.js";
import { SchedulerLeader, type SchedulerLeaderStatus } from "./scheduler-leader.js";
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

  private async fetchUpstreamReport(authToken: string, endpoint: string) {
    try {
      const upstreamResult = await forwardToUpstream(
        endpoint,
        {
          pageNumber: 1,
          pageSize: 200,
          page: 1,
          limit: 200,
        },
        authToken,
      );

      if (upstreamResult.statusCode >= 400 || upstreamResult.payload.code !== 0) {
        return [];
      }

      return extractRows(upstreamResult.payload.result);
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

    const lowPurchaseData = await this.fetchUpstreamReport(
      authToken,
      "/API/PrepayReport/LowPurchaseSituation",
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
    return {
      name: "analysis-engine",
      enabledByConfig: config.enableAnalysisEngine,
      schedulerRunning: this.schedulerRunning,
      leader: this.leader.getStatus(),
      lastRunStartedAt: this.lastRunStartedAt,
      lastRunCompletedAt: this.lastRunCompletedAt,
      lastRunDurationMs: this.lastRunDurationMs,
      lastError: this.lastError,
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
