import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { analysisEngine } from "../services/analysis-engine.js";
import { buildNotificationsCorrelatedFeed } from "../services/analytics-mix.js";
import { sendEnvelope } from "../services/response.js";

export const notificationRouter = Router();

notificationRouter.get("/correlated-feed", async (request, response) => {
  try {
    const result = await buildNotificationsCorrelatedFeed(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load notification correlations";
    sendEnvelope(response, 502, null, message, 1);
  }
});

notificationRouter.get("/", async (request, res) => {
  try {
    const authRequest = request as AuthenticatedRequest;
    const notifications = await analysisEngine.getUnreadNotifications(
      authRequest.authSession?.user.id ?? null,
    );
    sendEnvelope(res, 200, notifications, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch notifications";
    sendEnvelope(res, 500, null, message, 1);
  }
});

notificationRouter.post("/dismiss", async (req, res) => {
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

  const authRequest = req as AuthenticatedRequest;
  const dismissedCount = await analysisEngine.dismissNotifications(
    normalizedIds,
    authRequest.authSession?.user.id ?? null,
  );
  sendEnvelope(res, 200, { dismissedCount }, "success");
});

notificationRouter.post("/dismiss-all", async (req, res) => {
  const authRequest = req as AuthenticatedRequest;
  const dismissedCount = await analysisEngine.dismissAllNotifications(
    authRequest.authSession?.user.id ?? null,
  );
  sendEnvelope(res, 200, { dismissedCount }, "success");
});
