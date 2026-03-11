import { Router } from "express";
import { analysisEngine } from "../services/analysis-engine.js";
import { sendEnvelope } from "../services/response.js";

export const notificationRouter = Router();

notificationRouter.get("/", (_request, res) => {
  sendEnvelope(
    res,
    200,
    analysisEngine.notifications.filter((notification) => !notification.read),
    "success",
  );
});

notificationRouter.post("/dismiss", (req, res) => {
  const { ids } = req.body as { ids: string[] };

  if (!Array.isArray(ids)) {
    sendEnvelope(res, 400, null, "Array of ids required", 1);
    return;
  }

  let dismissedCount = 0;
  for (const notif of analysisEngine.notifications) {
    if (ids.includes(notif.id) && !notif.read) {
      notif.read = true;
      dismissedCount++;
    }
  }

  sendEnvelope(res, 200, { dismissedCount }, "success");
});

notificationRouter.post("/dismiss-all", (req, res) => {
  let dismissedCount = 0;
  for (const notif of analysisEngine.notifications) {
    if (!notif.read) {
      notif.read = true;
      dismissedCount++;
    }
  }

  sendEnvelope(res, 200, { dismissedCount }, "success");
});
