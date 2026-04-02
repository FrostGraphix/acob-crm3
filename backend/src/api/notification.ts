import { Router } from "express";
import { analysisEngine } from "../services/analysis-engine.js";
import { sendEnvelope } from "../services/response.js";

export const notificationRouter = Router();

notificationRouter.get("/", (_request, res) => {
  sendEnvelope(res, 200, analysisEngine.getUnreadNotifications(), "success");
});

notificationRouter.post("/dismiss", (req, res) => {
  const { ids } = req.body as { ids: unknown };

  if (!Array.isArray(ids)) {
    sendEnvelope(res, 400, null, "Array of ids required", 1);
    return;
  }

  const normalizedIds = ids.filter((id): id is string => typeof id === "string" && id.length > 0);
  if (normalizedIds.length === 0) {
    sendEnvelope(res, 400, null, "Array of ids required", 1);
    return;
  }

  const dismissedCount = analysisEngine.dismissNotifications(normalizedIds);
  sendEnvelope(res, 200, { dismissedCount }, "success");
});

notificationRouter.post("/dismiss-all", (req, res) => {
  const dismissedCount = analysisEngine.dismissAllNotifications();
  sendEnvelope(res, 200, { dismissedCount }, "success");
});
