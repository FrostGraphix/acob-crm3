import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { readDataEngineCatalog } from "../services/engine-catalog.js";
import { analysisEngine } from "../services/analysis-engine.js";
import { customerFactEngine } from "../services/customer-fact-engine.js";
import {
  buildOperationalPriorityResponse,
  buildRevenueLeakageResponse,
  operationalPriorityEngine,
  revenueLeakageEngine,
} from "../services/priority-engines.js";
import { sendEnvelope } from "../services/response.js";
import { walletReconciliationEngine } from "../services/wallet-reconciliation-engine.js";
import { siteConsumptionEngine } from "../services/site-consumption-engine.js";
import { isSupabaseDbEnabled, upsertRuntimeHealthFacts, type DbRuntimeHealthFact } from "../services/supabase-db.js";

type EngineKey =
  | "analysis"
  | "site-consumption"
  | "customer-facts"
  | "revenue-leakage"
  | "operational-priority"
  | "wallet-reconciliation";

function isAdmin(request: AuthenticatedRequest) {
  const role = request.authSession?.user.role?.toLowerCase() ?? "";
  return role.includes("admin");
}

function resolveEngine(engineKey: string) {
  if (engineKey === "analysis") {
    return {
      status: () => analysisEngine.getStatus(),
      start: () => analysisEngine.start(),
      stop: () => analysisEngine.stop(),
      runNow: () => analysisEngine.runNow(),
    };
  }

  if (engineKey === "site-consumption") {
    return {
      status: () => siteConsumptionEngine.getAdminStatus(),
      start: () => siteConsumptionEngine.start(),
      stop: () => siteConsumptionEngine.stop(),
      runNow: () => siteConsumptionEngine.runNow(),
    };
  }

  if (engineKey === "customer-facts") {
    return {
      status: () => customerFactEngine.getStatus(),
      start: () => customerFactEngine.start(),
      stop: () => customerFactEngine.stop(),
      runNow: () => customerFactEngine.runNow(),
    };
  }

  if (engineKey === "revenue-leakage") {
    return {
      status: () => revenueLeakageEngine.getStatus(),
      start: () => revenueLeakageEngine.start(),
      stop: () => revenueLeakageEngine.stop(),
      runNow: () => revenueLeakageEngine.runNow(),
    };
  }

  if (engineKey === "operational-priority") {
    return {
      status: () => operationalPriorityEngine.getStatus(),
      start: () => operationalPriorityEngine.start(),
      stop: () => operationalPriorityEngine.stop(),
      runNow: () => operationalPriorityEngine.runNow(),
    };
  }

  if (engineKey === "wallet-reconciliation") {
    return {
      status: () => walletReconciliationEngine.getStatus(),
      start: () => walletReconciliationEngine.start(),
      stop: () => walletReconciliationEngine.stop(),
      runNow: () => walletReconciliationEngine.runNow(),
    };
  }

  return null;
}

function toRuntimeHealthFact(
  entry: { name: string; enabledByConfig: boolean; schedulerRunning: boolean; lastRunCompletedAt: string | null; lastError: string | null },
  category: string,
  extraMetadata: Record<string, unknown> = {},
): DbRuntimeHealthFact {
  const now = Date.now();
  const lastRefreshedAt = entry.lastRunCompletedAt;
  const ageMinutes = lastRefreshedAt
    ? Math.max(0, Math.round((now - new Date(lastRefreshedAt).getTime()) / 60000))
    : 999999;
  const status: DbRuntimeHealthFact["status"] =
    !entry.enabledByConfig || !entry.schedulerRunning
      ? "offline"
      : entry.lastError
        ? "critical"
        : ageMinutes > 180
          ? "warning"
          : "healthy";

  return {
    engine_name: entry.name,
    category,
    status,
    freshness_score:
      status === "offline"
        ? 0
        : Math.max(0, Math.min(100, 100 - Math.round(ageMinutes / 3))),
    dataset_age_minutes: ageMinutes,
    last_success_at: entry.lastError ? null : lastRefreshedAt,
    last_failure_at: entry.lastError ? lastRefreshedAt ?? entry.lastRunCompletedAt : null,
    last_refreshed_at: lastRefreshedAt,
    error_message: entry.lastError,
    metadata: {
      schedulerRunning: entry.schedulerRunning,
      ...extraMetadata,
    },
  };
}

async function persistRuntimeHealth() {
  if (!isSupabaseDbEnabled()) {
    return;
  }

  const analysisStatus = analysisEngine.getStatus();
  const siteStatus = siteConsumptionEngine.getAdminStatus();
  const customerStatus = customerFactEngine.getStatus();
  const revenueStatus = revenueLeakageEngine.getStatus();
  const operationsStatus = operationalPriorityEngine.getStatus();
  const walletReconciliationStatus = walletReconciliationEngine.getStatus();

  void upsertRuntimeHealthFacts([
    toRuntimeHealthFact(analysisStatus, "monitoring", {
      theftMetrics: analysisStatus.theftMetrics ?? null,
    }),
    toRuntimeHealthFact(siteStatus, "consumption", {
      sourceWindow: siteStatus.sourceWindow,
    }),
    toRuntimeHealthFact(customerStatus, "forecasting", {
      rowMetrics: customerStatus.rowMetrics,
    }),
    toRuntimeHealthFact(revenueStatus, "risk", {
      rowCount: revenueStatus.rowCount,
    }),
    toRuntimeHealthFact(operationsStatus, "operations", {
      rowCount: operationsStatus.rowCount,
    }),
    toRuntimeHealthFact(walletReconciliationStatus, "operations", {
      walletDomain: "vendor-wallet",
    }),
  ]);
}

export const runtimeRouter = Router();

runtimeRouter.use((request, response, next) => {
  const authRequest = request as AuthenticatedRequest;
  if (!isAdmin(authRequest)) {
    sendEnvelope(response, 403, null, "Administrator access required", 1);
    return;
  }

  next();
});

runtimeRouter.get("/engines", (_request, response) => {
  void persistRuntimeHealth();
  sendEnvelope(
    response,
    200,
    {
      engines: {
        analysis: analysisEngine.getStatus(),
        siteConsumption: siteConsumptionEngine.getAdminStatus(),
        customerFacts: customerFactEngine.getStatus(),
        revenueLeakage: revenueLeakageEngine.getStatus(),
        operationalPriority: operationalPriorityEngine.getStatus(),
        walletReconciliation: walletReconciliationEngine.getStatus(),
      },
    },
    "success",
  );
});

runtimeRouter.get("/engine-catalog", (_request, response) => {
  sendEnvelope(response, 200, readDataEngineCatalog(), "success");
});

runtimeRouter.get("/revenue-leakage", async (request, response) => {
  const siteId = typeof request.query.siteId === "string" ? request.query.siteId : null;
  sendEnvelope(response, 200, await buildRevenueLeakageResponse(siteId), "success");
});

runtimeRouter.get("/operational-priority", async (request, response) => {
  const siteId = typeof request.query.siteId === "string" ? request.query.siteId : null;
  sendEnvelope(response, 200, await buildOperationalPriorityResponse(siteId), "success");
});

runtimeRouter.post("/engines/:engine/start", async (request, response) => {
  const engine = resolveEngine(request.params.engine);
  if (!engine) {
    sendEnvelope(response, 404, null, "Engine not found", 1);
    return;
  }

  await engine.start();
  void persistRuntimeHealth();
  sendEnvelope(response, 200, { status: engine.status() }, "Engine scheduler started");
});

runtimeRouter.post("/engines/:engine/stop", async (request, response) => {
  const engine = resolveEngine(request.params.engine);
  if (!engine) {
    sendEnvelope(response, 404, null, "Engine not found", 1);
    return;
  }

  await engine.stop();
  void persistRuntimeHealth();
  sendEnvelope(response, 200, { status: engine.status() }, "Engine scheduler stopped");
});

runtimeRouter.post("/engines/:engine/run", async (request, response) => {
  const engine = resolveEngine(request.params.engine);
  if (!engine) {
    sendEnvelope(response, 404, null, "Engine not found", 1);
    return;
  }

  const result = await engine.runNow();
  void persistRuntimeHealth();
  sendEnvelope(response, result.accepted ? 202 : 409, {
    status: engine.status(),
    runResult: result,
  }, result.reason, result.accepted ? 0 : 1);
});
