import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { accountRouter } from "./api/account.js";
import { authRouter } from "./api/auth.js";
import { customerRouter } from "./api/customer.js";
import { dailyDataMeterRouter } from "./api/daily-data-meter.js";
import { dashboardRouter } from "./api/dashboard.js";
import { debtRouter } from "./api/debt.js";
import { dlmsRouter } from "./api/dlms.js";
import { dlt645Router } from "./api/dlt645.js";
import { dlt645TaskRouter } from "./api/dlt645-task.js";
import { eventNotificationRouter } from "./api/event-notification.js";
import { fileUploadRouter } from "./api/file-upload.js";
import { gatewayRouter } from "./api/gateway.js";
import { itemRouter } from "./api/item.js";
import { loadProfileRouter } from "./api/load-profile.js";
import { logRouter } from "./api/log.js";
import { meterRouter } from "./api/meter.js";
import { proxyHandler } from "./api/proxy.js";
import { siteConsumptionRouter } from "./api/site-consumption.js";
import { remoteRouter } from "./api/remote.js";
import { reportRouter } from "./api/report.js";
import { runtimeRouter } from "./api/runtime.js";
import { tariffRouter } from "./api/tariff.js";
import { tokenRouter } from "./api/token.js";
import { userRouter } from "./api/user.js";
import { notificationRouter } from "./api/notification.js";
import { requireAuth } from "./middleware/auth.js";
import { requireCsrf } from "./middleware/csrf.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { metricsMiddleware } from "./middleware/metrics.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { env } from "./services/env.js";
import { readMetricsSnapshot } from "./services/metrics.js";
import { readRuntimeDiagnostics } from "./services/runtime-diagnostics.js";
import { checkRuntimeStateStoreHealth } from "./services/runtime-state-store.js";
import { checkSessionStoreHealth } from "./services/session-store.js";
import { checkUpstreamHealth } from "./services/upstream.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  if (env.nodeEnv !== "test") {
    app.use(morgan("combined"));
  }
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(metricsMiddleware);
  app.use(rateLimitMiddleware);

  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      service: "acob-crm3-backend",
      timestamp: new Date().toISOString(),
      runtime: readRuntimeDiagnostics(),
    });
  });

  app.get("/health/dependencies", async (_request, response) => {
    const [upstream, sessionStore, runtimeStateStore] = await Promise.all([
      checkUpstreamHealth(),
      checkSessionStoreHealth(),
      checkRuntimeStateStoreHealth(),
    ]);

    const ok = upstream.ok && sessionStore.ok && runtimeStateStore.ok;
    response.status(ok ? 200 : 503).json({
      status: ok ? "ok" : "degraded",
      service: "acob-crm3-backend",
      timestamp: new Date().toISOString(),
      runtime: readRuntimeDiagnostics(),
      dependencies: {
        upstream,
        sessionStore,
        runtimeStateStore,
      },
    });
  });

  if (env.enableMetrics) {
    app.get("/metrics", (_request, response) => {
      response.status(200).json(readMetricsSnapshot());
    });
  }

  // --- Auth (public + protected) ---
  app.use("/api/user", authRouter);
  app.use("/api/user", requireAuth, requireCsrf, userRouter);

  // --- Core domain routers ---
  app.use("/api/dashboard", requireAuth, requireCsrf, dashboardRouter);
  app.use("/api/account", requireAuth, requireCsrf, accountRouter);
  app.use("/api/customer", requireAuth, requireCsrf, customerRouter);
  app.use("/api/tariff", requireAuth, requireCsrf, tariffRouter);
  app.use("/api/gateway", requireAuth, requireCsrf, gatewayRouter);
  app.use("/api/meter", requireAuth, requireCsrf, meterRouter);
  app.use("/api/token", requireAuth, requireCsrf, tokenRouter);
  app.use("/api/DailyDataMeter", requireAuth, requireCsrf, dailyDataMeterRouter);
  app.use("/api/site-consumption", requireAuth, requireCsrf, siteConsumptionRouter);

  // --- New domain routers ---
  app.use("/api/debt", requireAuth, requireCsrf, debtRouter);
  app.use("/api/dlms", requireAuth, requireCsrf, dlmsRouter);
  app.use("/api/dlt645", requireAuth, requireCsrf, dlt645Router);
  app.use("/api/DLT645Task", requireAuth, requireCsrf, dlt645TaskRouter);
  app.use("/api/item", requireAuth, requireCsrf, itemRouter);
  app.use("/api/Log", requireAuth, requireCsrf, logRouter);
  app.use("/API/LoadProfile", requireAuth, requireCsrf, loadProfileRouter);
  app.use("/API/EventNotification", requireAuth, requireCsrf, eventNotificationRouter);
  app.use("/API/File", requireAuth, requireCsrf, fileUploadRouter);

  // --- Remote & Reports ---
  app.use("/API/RemoteMeterTask", requireAuth, requireCsrf, remoteRouter);
  app.use("/API/PrepayReport", requireAuth, requireCsrf, reportRouter);
  app.use("/api/notifications", requireAuth, requireCsrf, notificationRouter);
  app.use("/api/runtime", requireAuth, requireCsrf, runtimeRouter);

  // Endpoint registry still protects this route from unknown paths.
  app.post(/^\/(?:api|API)\//, requireAuth, requireCsrf, proxyHandler);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
