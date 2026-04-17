import cron from "node-cron";
import type { OperationalPriorityResponse, RevenueLeakageResponse } from "../../../common/types/index.js";
import { extractRows, readNumber, readString, type ReportRow } from "../lib/upstream-data.js";
import { env } from "./env.js";
import { SchedulerLeader, type SchedulerLeaderStatus } from "./scheduler-leader.js";
import {
  createAnalysisRun,
  isSupabaseDbEnabled,
  listCustomerForecasts,
  listOperationalPriorityFacts,
  listRevenueLeakageFacts,
  upsertOperationalPriorityFacts,
  upsertRevenueLeakageFacts,
} from "./supabase-db.js";
import { theftIntelligenceService } from "./theft-intelligence.js";
import { forwardToUpstream, loginToUpstream } from "./upstream.js";
import { updateAnalysisRun } from "./supabase-db.js";

export interface ManagedRiskEngineStatus {
  name: string;
  enabledByConfig: boolean;
  schedulerRunning: boolean;
  leader: SchedulerLeaderStatus;
  lastRunStartedAt: string | null;
  lastRunCompletedAt: string | null;
  lastRunDurationMs: number | null;
  lastError: string | null;
  rowCount: number;
}

function normalizeMeterId(row: ReportRow) {
  return readString(row, ["meterId", "meterSN", "meterNo", "meterCode"]) ?? "";
}

function normalizeCustomerName(row: ReportRow) {
  return readString(row, ["customerName", "name", "customer", "userName"]) ?? "";
}

function normalizeSite(row: ReportRow) {
  return readString(row, ["stationId", "siteId", "site", "station", "siteName"]) ?? "";
}

async function fetchRows(pathname: string, body: Record<string, unknown>, authToken: string) {
  const result = await forwardToUpstream(pathname, body, authToken, { timeoutMs: 45_000 });
  if (result.statusCode >= 400 || result.payload.code !== 0) {
    return [] as ReportRow[];
  }
  return extractRows(result.payload.result);
}

async function buildRevenueLeakageRowsFromUpstream() {
  const login = await loginToUpstream({
    username: env.upstreamUsername,
    password: env.upstreamPassword,
  });
  if (login.statusCode >= 400 || !login.upstreamCookie) {
    throw new Error("Unable to authenticate revenue leakage engine against upstream.");
  }

  const authToken = login.upstreamCookie;
  const [lowPurchaseRows, nonPurchaseRows] = await Promise.all([
    fetchRows("/API/PrepayReport/LowPurchaseSituation", { pageNumber: 1, pageSize: 1000, page: 1, limit: 1000 }, authToken),
    fetchRows("/API/PrepayReport/LongNonpurchaseSituation", { pageNumber: 1, pageSize: 1000, page: 1, limit: 1000 }, authToken),
  ]);
  const activeSignals = theftIntelligenceService.listSignals();

  const lowMap = new Map<string, { customerName: string; site: string; score: number; reasons: string[] }>();
  for (const row of lowPurchaseRows) {
    const meterId = normalizeMeterId(row);
    if (!meterId) {
      continue;
    }
    lowMap.set(meterId, {
      customerName: normalizeCustomerName(row) || meterId,
      site: normalizeSite(row),
      score: 35,
      reasons: ["Low purchase pattern"],
    });
  }

  for (const row of nonPurchaseRows) {
    const meterId = normalizeMeterId(row);
    if (!meterId) {
      continue;
    }
    const current = lowMap.get(meterId) ?? {
      customerName: normalizeCustomerName(row) || meterId,
      site: normalizeSite(row),
      score: 0,
      reasons: [] as string[],
    };
    current.score += 45;
    current.reasons.push("Long non-purchase pattern");
    lowMap.set(meterId, current);
  }

  for (const signal of activeSignals) {
    const current = lowMap.get(signal.meterId) ?? {
      customerName: signal.customerName ?? signal.meterId,
      site: signal.siteId ?? "",
      score: 0,
      reasons: [] as string[],
    };
    current.score += signal.score;
    current.reasons.push(`Theft signal: ${signal.severity}`);
    lowMap.set(signal.meterId, current);
  }

  return Array.from(lowMap.entries())
    .map(([meterId, value]) => ({
      meter_sn: meterId,
      customer_name: value.customerName,
      site_id: value.site || null,
      leakage_score: Math.round(value.score * 100) / 100,
      estimated_loss_kwh: Math.round((value.score / 3) * 100) / 100,
      reasons: Array.from(new Set(value.reasons)),
      metadata: {},
    }))
    .sort((left, right) => right.leakage_score - left.leakage_score);
}

async function buildOperationalPriorityRowsFromWarehouse() {
  const [leakageRows, forecastRows] = await Promise.all([
    listRevenueLeakageFacts({ limit: 500 }),
    listCustomerForecasts({ limit: 500 }),
  ]);
  const caseMap = new Map(theftIntelligenceService.listCases().map((entry) => [entry.meterId, entry]));

  return leakageRows.map((row) => {
    const forecast = forecastRows.find((entry) => entry.meter_sn === row.meter_sn);
    const theftCase = caseMap.get(row.meter_sn);
    const forecastUrgency =
      forecast && Number(forecast.estimated_days_covered) <= 3
        ? 25
        : forecast && Number(forecast.estimated_days_covered) <= 7
          ? 12
          : 0;
    const caseUrgency = theftCase ? 20 : 0;
    const priorityScore = Math.round((Number(row.leakage_score ?? 0) + forecastUrgency + caseUrgency) * 100) / 100;

    const reasons = [...(Array.isArray(row.reasons) ? row.reasons : [])];
    if (forecastUrgency > 0) {
      reasons.push("Customer depletion forecast is near-term");
    }
    if (caseUrgency > 0) {
      reasons.push(`Open theft case: ${theftCase?.status}`);
    }

    return {
      meter_sn: row.meter_sn,
      customer_name: row.customer_name ?? row.meter_sn,
      site_id: row.site_code ?? null,
      priority_score: priorityScore,
      recommended_action:
        priorityScore >= 90 ? "Immediate field investigation" :
        priorityScore >= 65 ? "High-priority outreach and meter read" :
        "Monitor and schedule follow-up",
      reasons: Array.from(new Set(reasons)),
      metadata: {
        leakageScore: Number(row.leakage_score ?? 0),
        estimatedDaysCovered: forecast ? Number(forecast.estimated_days_covered ?? 0) : null,
      },
    };
  });
}

class RevenueLeakageEngine {
  private cronJob: cron.ScheduledTask | null = null;
  private refreshPromise: Promise<void> | null = null;
  private schedulerRunning = false;
  private lastRunStartedAt: string | null = null;
  private lastRunCompletedAt: string | null = null;
  private lastRunDurationMs: number | null = null;
  private lastError: string | null = null;
  private rowCount = 0;
  private readonly leader = new SchedulerLeader("revenue-leakage-engine", {
    onLeadershipAcquired: () => {
      this.ensureCronSchedule();
      this.scheduleImmediateRefresh(4_000);
    },
    onLeadershipLost: () => {
      this.stopCronSchedule();
    },
  });

  private async refresh() {
    if (this.refreshPromise || !isSupabaseDbEnabled()) {
      return this.refreshPromise ?? Promise.resolve();
    }
    this.refreshPromise = (async () => {
      const startedAt = Date.now();
      this.lastRunStartedAt = new Date(startedAt).toISOString();
      this.lastError = null;
      let runRecord: { id?: string } | null = null;

      try {
        runRecord = await createAnalysisRun({ engine_name: "revenue-leakage-engine" });
        const rows = await buildRevenueLeakageRowsFromUpstream();
        await upsertRevenueLeakageFacts(rows);
        this.rowCount = rows.length;
        this.lastRunCompletedAt = new Date().toISOString();
        this.lastRunDurationMs = Date.now() - startedAt;
        if (runRecord?.id) {
          void updateAnalysisRun(runRecord.id, {
            status: "completed",
            completed_at: this.lastRunCompletedAt,
            duration_ms: this.lastRunDurationMs,
            metadata: { rowCount: this.rowCount },
          });
        }
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : "Revenue leakage refresh failed";
        this.lastRunCompletedAt = new Date().toISOString();
        this.lastRunDurationMs = Date.now() - startedAt;
        if (runRecord?.id) {
          void updateAnalysisRun(runRecord.id, {
            status: "failed",
            completed_at: this.lastRunCompletedAt,
            duration_ms: this.lastRunDurationMs,
            error_message: this.lastError,
          });
        }
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  public start() {
    if (this.schedulerRunning) {
      return;
    }
    this.schedulerRunning = true;
    this.leader.start();
  }

  public async stop() {
    if (!this.schedulerRunning) {
      return;
    }
    this.schedulerRunning = false;
    this.stopCronSchedule();
    await this.leader.stop();
  }

  public getStatus(): ManagedRiskEngineStatus {
    return {
      name: "revenue-leakage-engine",
      enabledByConfig: isSupabaseDbEnabled(),
      schedulerRunning: this.schedulerRunning,
      leader: this.leader.getStatus(),
      lastRunStartedAt: this.lastRunStartedAt,
      lastRunCompletedAt: this.lastRunCompletedAt,
      lastRunDurationMs: this.lastRunDurationMs,
      lastError: this.lastError,
      rowCount: this.rowCount,
    };
  }

  public async runNow() {
    if (!this.leader.currentlyLeads()) {
      return {
        accepted: false,
        reason: "This replica is not the active leader for revenue-leakage-engine.",
      };
    }
    await this.refresh();
    return { accepted: true, reason: "Revenue leakage facts refreshed on the active leader." };
  }

  private ensureCronSchedule() {
    if (this.cronJob) {
      return;
    }
    this.cronJob = cron.schedule("*/15 * * * *", () => {
      void this.refresh();
    });
  }

  private stopCronSchedule() {
    if (!this.cronJob) {
      return;
    }
    this.cronJob.stop();
    this.cronJob = null;
  }

  private scheduleImmediateRefresh(delayMs: number) {
    setTimeout(() => {
      if (this.schedulerRunning && this.leader.currentlyLeads()) {
        void this.refresh();
      }
    }, delayMs);
  }
}

class OperationalPriorityEngine {
  private cronJob: cron.ScheduledTask | null = null;
  private refreshPromise: Promise<void> | null = null;
  private schedulerRunning = false;
  private lastRunStartedAt: string | null = null;
  private lastRunCompletedAt: string | null = null;
  private lastRunDurationMs: number | null = null;
  private lastError: string | null = null;
  private rowCount = 0;
  private readonly leader = new SchedulerLeader("operational-priority-engine", {
    onLeadershipAcquired: () => {
      this.ensureCronSchedule();
      this.scheduleImmediateRefresh(6_000);
    },
    onLeadershipLost: () => {
      this.stopCronSchedule();
    },
  });

  private async refresh() {
    if (this.refreshPromise || !isSupabaseDbEnabled()) {
      return this.refreshPromise ?? Promise.resolve();
    }
    this.refreshPromise = (async () => {
      const startedAt = Date.now();
      this.lastRunStartedAt = new Date(startedAt).toISOString();
      this.lastError = null;
      let runRecord: { id?: string } | null = null;
      try {
        runRecord = await createAnalysisRun({ engine_name: "operational-priority-engine" });
        const rows = await buildOperationalPriorityRowsFromWarehouse();
        await upsertOperationalPriorityFacts(rows);
        this.rowCount = rows.length;
        this.lastRunCompletedAt = new Date().toISOString();
        this.lastRunDurationMs = Date.now() - startedAt;
        if (runRecord?.id) {
          void updateAnalysisRun(runRecord.id, {
            status: "completed",
            completed_at: this.lastRunCompletedAt,
            duration_ms: this.lastRunDurationMs,
            metadata: { rowCount: this.rowCount },
          });
        }
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : "Operational priority refresh failed";
        this.lastRunCompletedAt = new Date().toISOString();
        this.lastRunDurationMs = Date.now() - startedAt;
        if (runRecord?.id) {
          void updateAnalysisRun(runRecord.id, {
            status: "failed",
            completed_at: this.lastRunCompletedAt,
            duration_ms: this.lastRunDurationMs,
            error_message: this.lastError,
          });
        }
      } finally {
        this.refreshPromise = null;
      }
    })();
    return this.refreshPromise;
  }

  public start() {
    if (this.schedulerRunning) {
      return;
    }
    this.schedulerRunning = true;
    this.leader.start();
  }

  public async stop() {
    if (!this.schedulerRunning) {
      return;
    }
    this.schedulerRunning = false;
    this.stopCronSchedule();
    await this.leader.stop();
  }

  public getStatus(): ManagedRiskEngineStatus {
    return {
      name: "operational-priority-engine",
      enabledByConfig: isSupabaseDbEnabled(),
      schedulerRunning: this.schedulerRunning,
      leader: this.leader.getStatus(),
      lastRunStartedAt: this.lastRunStartedAt,
      lastRunCompletedAt: this.lastRunCompletedAt,
      lastRunDurationMs: this.lastRunDurationMs,
      lastError: this.lastError,
      rowCount: this.rowCount,
    };
  }

  public async runNow() {
    if (!this.leader.currentlyLeads()) {
      return {
        accepted: false,
        reason: "This replica is not the active leader for operational-priority-engine.",
      };
    }
    await this.refresh();
    return { accepted: true, reason: "Operational priority facts refreshed on the active leader." };
  }

  private ensureCronSchedule() {
    if (this.cronJob) {
      return;
    }
    this.cronJob = cron.schedule("*/5 * * * *", () => {
      void this.refresh();
    });
  }

  private stopCronSchedule() {
    if (!this.cronJob) {
      return;
    }
    this.cronJob.stop();
    this.cronJob = null;
  }

  private scheduleImmediateRefresh(delayMs: number) {
    setTimeout(() => {
      if (this.schedulerRunning && this.leader.currentlyLeads()) {
        void this.refresh();
      }
    }, delayMs);
  }
}

export async function buildRevenueLeakageResponse(siteId?: string | null): Promise<RevenueLeakageResponse> {
  const rows = isSupabaseDbEnabled() ? await listRevenueLeakageFacts({ siteId, limit: 200 }) : [];
  return {
    generatedAt: new Date().toISOString(),
    rows: rows.map((row) => ({
      meterId: row.meter_sn,
      customerName: row.customer_name ?? row.meter_sn,
      site: row.site_code ?? null,
      leakageScore: Math.round(Number(row.leakage_score ?? 0) * 100) / 100,
      estimatedLossKwh: Math.round(Number(row.estimated_loss_kwh ?? 0) * 100) / 100,
      reasons: Array.isArray(row.reasons) ? row.reasons : [],
    })),
  };
}

export async function buildOperationalPriorityResponse(siteId?: string | null): Promise<OperationalPriorityResponse> {
  const rows = isSupabaseDbEnabled() ? await listOperationalPriorityFacts({ siteId, limit: 200 }) : [];
  return {
    generatedAt: new Date().toISOString(),
    rows: rows.map((row) => ({
      meterId: row.meter_sn,
      customerName: row.customer_name ?? row.meter_sn,
      site: row.site_code ?? null,
      priorityScore: Math.round(Number(row.priority_score ?? 0) * 100) / 100,
      recommendedAction: row.recommended_action ?? "Monitor",
      reasons: Array.isArray(row.reasons) ? row.reasons : [],
    })),
  };
}

export const revenueLeakageEngine = new RevenueLeakageEngine();
export const operationalPriorityEngine = new OperationalPriorityEngine();
