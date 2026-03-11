import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { accountRouter } from "./api/account.js";
import { authRouter } from "./api/auth.js";
import { customerRouter } from "./api/customer.js";
import { dailyDataMeterRouter } from "./api/daily-data-meter.js";
import { dashboardRouter } from "./api/dashboard.js";
import { gatewayRouter } from "./api/gateway.js";
import { meterRouter } from "./api/meter.js";
import { proxyHandler } from "./api/proxy.js";
import { remoteRouter } from "./api/remote.js";
import { reportRouter } from "./api/report.js";
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
  app.use(morgan("combined"));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(metricsMiddleware);
  app.use(rateLimitMiddleware);

  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      service: "acob-crm3-backend",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/health/dependencies", async (_request, response) => {
    const [upstream, sessionStore] = await Promise.all([
      checkUpstreamHealth(),
      checkSessionStoreHealth(),
    ]);

    const ok = upstream.ok && sessionStore.ok;
    response.status(ok ? 200 : 503).json({
      status: ok ? "ok" : "degraded",
      service: "acob-crm3-backend",
      timestamp: new Date().toISOString(),
      dependencies: {
        upstream,
        sessionStore,
      },
    });
  });

  if (env.enableMetrics) {
    app.get("/metrics", (_request, response) => {
      response.status(200).json(readMetricsSnapshot());
    });
  }

  app.use("/api/user", authRouter);
  app.use("/api/user", requireAuth, requireCsrf, userRouter);
  app.use("/api/dashboard", requireAuth, requireCsrf, dashboardRouter);
  app.use("/api/account", requireAuth, requireCsrf, accountRouter);
  app.use("/api/customer", requireAuth, requireCsrf, customerRouter);
  app.use("/api/tariff", requireAuth, requireCsrf, tariffRouter);
  app.use("/api/gateway", requireAuth, requireCsrf, gatewayRouter);
  app.use("/api/meter", requireAuth, requireCsrf, meterRouter);
  app.use("/api/token", requireAuth, requireCsrf, tokenRouter);
  app.use("/api/DailyDataMeter", requireAuth, requireCsrf, dailyDataMeterRouter);
  app.use("/API/RemoteMeterTask", requireAuth, requireCsrf, remoteRouter);
  app.use("/API/PrepayReport", requireAuth, requireCsrf, reportRouter);
  app.use("/api/notifications", requireAuth, requireCsrf, notificationRouter);

  // Endpoint registry still protects this route from unknown paths.
  app.post(/^\/(?:api|API)\//, requireAuth, requireCsrf, proxyHandler);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
