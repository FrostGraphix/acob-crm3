import { Router } from "express";
import { siteConsumptionEngine } from "../services/site-consumption-engine.js";
import { sendEnvelope } from "../services/response.js";

export const siteConsumptionRouter = Router();

siteConsumptionRouter.get("/status", (_request, response) => {
  sendEnvelope(response, 200, {
    status: siteConsumptionEngine.getStatus(),
    snapshot: siteConsumptionEngine.getSnapshot(),
  }, "success");
});

siteConsumptionRouter.get("/summary", (_request, response) => {
  const snapshot = siteConsumptionEngine.getSnapshot();
  sendEnvelope(response, 200, {
    lastUpdatedAt: siteConsumptionEngine.getStatus().lastUpdatedAt,
    sourceWindow: snapshot.sourceWindow,
    summary: snapshot.summary,
  }, "success");
});

siteConsumptionRouter.get("/daily", (_request, response) => {
  const snapshot = siteConsumptionEngine.getSnapshot();
  sendEnvelope(response, 200, {
    lastUpdatedAt: siteConsumptionEngine.getStatus().lastUpdatedAt,
    sourceWindow: snapshot.sourceWindow,
    series: snapshot.daily,
  }, "success");
});

siteConsumptionRouter.get("/monthly", (_request, response) => {
  const snapshot = siteConsumptionEngine.getSnapshot();
  sendEnvelope(response, 200, {
    lastUpdatedAt: siteConsumptionEngine.getStatus().lastUpdatedAt,
    sourceWindow: snapshot.sourceWindow,
    series: snapshot.monthly,
  }, "success");
});

siteConsumptionRouter.get("/yearly", (_request, response) => {
  const snapshot = siteConsumptionEngine.getSnapshot();
  sendEnvelope(response, 200, {
    lastUpdatedAt: siteConsumptionEngine.getStatus().lastUpdatedAt,
    sourceWindow: snapshot.sourceWindow,
    series: snapshot.yearly,
  }, "success");
});

siteConsumptionRouter.post("/refresh", (_request, response) => {
  siteConsumptionEngine.requestRefresh();
  sendEnvelope(response, 202, {
    status: siteConsumptionEngine.getStatus(),
    snapshot: siteConsumptionEngine.getSnapshot(),
  }, "refresh started");
});
