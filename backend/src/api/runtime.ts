import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { analysisEngine } from "../services/analysis-engine.js";
import { sendEnvelope } from "../services/response.js";
import { siteConsumptionEngine } from "../services/site-consumption-engine.js";

type EngineKey = "analysis" | "site-consumption";

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

  return null;
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
  sendEnvelope(
    response,
    200,
    {
      engines: {
        analysis: analysisEngine.getStatus(),
        siteConsumption: siteConsumptionEngine.getAdminStatus(),
      },
    },
    "success",
  );
});

runtimeRouter.post("/engines/:engine/start", async (request, response) => {
  const engine = resolveEngine(request.params.engine);
  if (!engine) {
    sendEnvelope(response, 404, null, "Engine not found", 1);
    return;
  }

  await engine.start();
  sendEnvelope(response, 200, { status: engine.status() }, "Engine scheduler started");
});

runtimeRouter.post("/engines/:engine/stop", async (request, response) => {
  const engine = resolveEngine(request.params.engine);
  if (!engine) {
    sendEnvelope(response, 404, null, "Engine not found", 1);
    return;
  }

  await engine.stop();
  sendEnvelope(response, 200, { status: engine.status() }, "Engine scheduler stopped");
});

runtimeRouter.post("/engines/:engine/run", async (request, response) => {
  const engine = resolveEngine(request.params.engine);
  if (!engine) {
    sendEnvelope(response, 404, null, "Engine not found", 1);
    return;
  }

  const result = await engine.runNow();
  sendEnvelope(response, result.accepted ? 202 : 409, {
    status: engine.status(),
    runResult: result,
  }, result.reason, result.accepted ? 0 : 1);
});
