import { randomUUID } from "node:crypto";
import cron from "node-cron";
import { env as config } from "./env.js";
import { forwardToUpstream, loginToUpstream } from "./upstream.js";

interface NotificationItem {
  id: string;
  type: "warning" | "critical" | "info";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  meterId?: string;
}

type ReportRow = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asRecordArray(value: unknown): ReportRow[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is ReportRow =>
          typeof entry === "object" && entry !== null && !Array.isArray(entry),
      )
    : [];
}

function firstAvailableRows(candidates: unknown[]) {
  let fallback: ReportRow[] = [];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const rows = asRecordArray(candidate);
      if (rows.length > 0) {
        return rows;
      }

      fallback = rows;
    }
  }

  return fallback;
}

function extractRows(result: unknown): ReportRow[] {
  if (Array.isArray(result)) {
    return asRecordArray(result);
  }

  const root = asRecord(result);
  const page = asRecord(root.page);

  return firstAvailableRows([
    root.rows,
    root.list,
    root.data,
    root.records,
    page.rows,
    page.list,
    page.data,
    page.records,
  ]);
}

function readString(record: ReportRow, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function readNumber(record: ReportRow, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
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

  return undefined;
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

class AnalysisEngine {
  private cronJob: cron.ScheduledTask | null = null;
  private knownAlerts = new Set<string>();
  public notifications: NotificationItem[] = [];

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
    console.log("[AnalysisEngine] Starting scheduled analysis cycle...");
    const authToken = await this.getUpstreamAuth();

    if (!authToken) {
      console.error("[AnalysisEngine] Aborting cycle because upstream authentication failed.");
      return;
    }

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
      }
    }

    if (this.knownAlerts.size > 5000) {
      this.knownAlerts.clear();
    }

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

  public start() {
    if (this.cronJob) {
      return;
    }

    this.cronJob = cron.schedule("*/15 * * * *", () => {
      void this.runAnalysisCycle();
    });

    setTimeout(() => {
      void this.runAnalysisCycle();
    }, 5000);

    console.log("[AnalysisEngine] Background service initialized (15m schedule).");
  }

  public stop() {
    if (!this.cronJob) {
      return;
    }

    this.cronJob.stop();
    this.cronJob = null;
  }
}

export const analysisEngine = new AnalysisEngine();
