import { randomUUID } from "node:crypto";
import axios from "axios";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { accountRouter } from "./api/account.js";
import { authRouter } from "./api/auth.js";
import { customerRouter } from "./api/customer.js";
import { dailyDataRouter } from "./api/daily-data.js";
import { dailyDataMeterRouter } from "./api/daily-data-meter.js";
import { dashboardRouter } from "./api/dashboard.js";
import { debtRouter } from "./api/debt.js";
import { dlmsRouter } from "./api/dlms.js";
import { dlt645Router } from "./api/dlt645.js";
import { dlt645TaskRouter } from "./api/dlt645-task.js";
import { documentRouter } from "./api/documents.js";
import { eventNotificationRouter } from "./api/event-notification.js";
import { fileUploadRouter } from "./api/file-upload.js";
import { gatewayRouter } from "./api/gateway.js";
import { gprsOnlineStatusRouter } from "./api/gprs-online-status.js";
import { gprsMeterTaskRouter } from "./api/gprs-meter-task.js";
import { itemRouter } from "./api/item.js";
import { loadProfileRouter } from "./api/load-profile.js";
import { logRouter } from "./api/log.js";
import { managementAnalyticsRouter } from "./api/management-analytics.js";
import { meterRouter } from "./api/meter.js";
import { operationsRouter } from "./api/operations.js";
import { proxyHandler } from "./api/proxy.js";
import { siteConsumptionRouter } from "./api/site-consumption.js";
import { remoteRouter } from "./api/remote.js";
import { reportRouter } from "./api/report.js";
import { reconciliationRouter } from "./api/reconciliation.js";
import { runtimeRouter } from "./api/runtime.js";
import { searchRouter } from "./api/search.js";
import { restAliasesRouter } from "./api/rest-aliases.js";
import { roleRouter } from "./api/role.js";
import { tariffRouter } from "./api/tariff.js";
import { tokenRouter } from "./api/token.js";
import { stationRouter } from "./api/station.js";
import { updateFirmwareTaskRouter } from "./api/update-firmware-task.js";
import { userRouter } from "./api/user.js";
import { vendorRouter } from "./api/vendor.js";
import { walletRouter } from "./api/wallet.js";
import { notificationRouter } from "./api/notification.js";
import { requireAuth } from "./middleware/auth.js";
import { requireRouteAccess } from "./middleware/authorization.js";
import { requireCsrf } from "./middleware/csrf.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { metricsMiddleware } from "./middleware/metrics.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { requireWalletRouteAccess } from "./middleware/wallet-route-guard.js";
import { env } from "./services/env.js";
import { readMetricsSnapshot } from "./services/metrics.js";
import { readRuntimeDiagnostics } from "./services/runtime-diagnostics.js";
import { checkRuntimeStateStoreHealth } from "./services/runtime-state-store.js";
import { checkSessionStoreHealth } from "./services/session-store.js";
import { checkSupabaseDbHealth } from "./services/supabase-db.js";
import { checkUpstreamHealth } from "./services/upstream.js";
import { theftRouter } from "./api/theft.js";

function buildReferenceFrontendUrl(pathname: string) {
  const upstreamUrl = new URL(env.upstreamApiUrl);
  upstreamUrl.port = "9311";
  upstreamUrl.pathname = pathname;
  upstreamUrl.search = "";
  return upstreamUrl.toString();
}

async function proxyReferenceFrontendAsset(
  request: express.Request,
  response: express.Response,
  pathname: string,
) {
  try {
    const upstreamResponse = await axios.get<ArrayBuffer>(buildReferenceFrontendUrl(pathname), {
      responseType: "arraybuffer",
      timeout: 15_000,
      proxy: false,
      validateStatus: () => true,
    });

    const contentType = upstreamResponse.headers["content-type"];
    const cacheControl = upstreamResponse.headers["cache-control"];

    if (contentType) {
      response.setHeader("content-type", contentType);
    }
    if (cacheControl) {
      response.setHeader("cache-control", cacheControl);
    }

    response.status(upstreamResponse.status).send(Buffer.from(upstreamResponse.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load reference asset";
    response.status(502).json({
      code: 1,
      reason: message,
      result: null,
    });
  }
}

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
  app.use((_request, response, next) => {
    response.locals.traceId = randomUUID();
    next();
  });
  app.use(metricsMiddleware);
  app.use(rateLimitMiddleware);

  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      service: "beverly-backend",
      timestamp: new Date().toISOString(),
      runtime: readRuntimeDiagnostics(),
    });
  });

  app.get("/health/dependencies", async (_request, response) => {
    const [upstream, sessionStore, runtimeStateStore, supabaseDb] = await Promise.all([
      checkUpstreamHealth(),
      checkSessionStoreHealth(),
      checkRuntimeStateStoreHealth(),
      checkSupabaseDbHealth(),
    ]);

    const ok = upstream.ok && sessionStore.ok && runtimeStateStore.ok;
    response.status(ok ? 200 : 503).json({
      status: ok ? "ok" : "degraded",
      service: "beverly-backend",
      timestamp: new Date().toISOString(),
      runtime: readRuntimeDiagnostics(),
      dependencies: {
        upstream,
        sessionStore,
        runtimeStateStore,
        supabaseDb,
      },
    });
  });

  if (env.enableMetrics) {
    app.get("/metrics", (_request, response) => {
      response.status(200).json(readMetricsSnapshot());
    });
  }

  app.get("/favicon.ico", async (request, response) => {
    await proxyReferenceFrontendAsset(request, response, "/favicon.ico");
  });

  app.get(/^\/static\/.+/, async (request, response) => {
    await proxyReferenceFrontendAsset(request, response, request.path);
  });

  // --- Auth (public + protected) ---
  app.use("/api/user", authRouter);
  app.use("/api/user", requireAuth, requireCsrf, userRouter);

  // --- Core domain routers ---
  app.use("/api", requireAuth, requireCsrf, requireRouteAccess, restAliasesRouter);
  app.use("/api/dashboard", requireAuth, requireCsrf, requireRouteAccess, dashboardRouter);
  app.use("/api/account", requireAuth, requireCsrf, requireRouteAccess, accountRouter);
  app.use("/api/customer", requireAuth, requireCsrf, requireRouteAccess, customerRouter);
  app.use("/api/tariff", requireAuth, requireCsrf, requireRouteAccess, tariffRouter);
  app.use("/api/gateway", requireAuth, requireCsrf, requireRouteAccess, gatewayRouter);
  app.use("/api/meter", requireAuth, requireCsrf, requireRouteAccess, meterRouter);
  app.use("/api/station", requireAuth, requireCsrf, requireRouteAccess, stationRouter);
  app.use("/api/role", requireAuth, requireCsrf, requireRouteAccess, roleRouter);
  app.use("/api/token", requireAuth, requireCsrf, requireRouteAccess, tokenRouter);
  app.use("/api/DailyData", requireAuth, requireCsrf, requireRouteAccess, dailyDataRouter);
  app.use("/api/dailyData", requireAuth, requireCsrf, requireRouteAccess, dailyDataRouter);
  app.use("/api/DailyDataMeter", requireAuth, requireCsrf, requireRouteAccess, dailyDataMeterRouter);
  app.use(
    "/api/management/analytics",
    requireAuth,
    requireCsrf,
    requireRouteAccess,
    managementAnalyticsRouter,
  );
  app.use("/api/site-consumption", requireAuth, requireCsrf, requireRouteAccess, siteConsumptionRouter);
  app.use("/api/operations", requireAuth, requireCsrf, requireRouteAccess, operationsRouter);

  // --- New domain routers ---
  app.use("/api/debt", requireAuth, requireCsrf, requireRouteAccess, debtRouter);
  app.use("/api/dlms", requireAuth, requireCsrf, requireRouteAccess, dlmsRouter);
  app.use("/api/dlt645", requireAuth, requireCsrf, requireRouteAccess, dlt645Router);
  app.use("/api/DLT645Task", requireAuth, requireCsrf, requireRouteAccess, dlt645TaskRouter);
  app.use("/api/item", requireAuth, requireCsrf, requireRouteAccess, itemRouter);
  app.use("/api/Log", requireAuth, requireCsrf, requireRouteAccess, logRouter);
  app.use("/API/LoadProfile", requireAuth, requireCsrf, requireRouteAccess, loadProfileRouter);
  app.use("/api/loadProfile", requireAuth, requireCsrf, requireRouteAccess, loadProfileRouter);
  app.use("/API/EventNotification", requireAuth, requireCsrf, requireRouteAccess, eventNotificationRouter);
  app.use("/api/eventNotification", requireAuth, requireCsrf, requireRouteAccess, eventNotificationRouter);
  app.use("/API/File", requireAuth, requireCsrf, requireRouteAccess, fileUploadRouter);
  app.use("/api/file", requireAuth, requireCsrf, requireRouteAccess, fileUploadRouter);

  // --- Remote & Reports ---
  app.use("/API/RemoteMeterTask", requireAuth, requireCsrf, requireRouteAccess, remoteRouter);
  app.use("/api/remoteMeterTask", requireAuth, requireCsrf, requireRouteAccess, remoteRouter);
  app.use("/API/GPRSMeterTask", requireAuth, requireCsrf, requireRouteAccess, gprsMeterTaskRouter);
  app.use("/api/GPRSMeterTask", requireAuth, requireCsrf, requireRouteAccess, gprsMeterTaskRouter);
  app.use("/API/GPRSOnlineStatus", requireAuth, requireCsrf, requireRouteAccess, gprsOnlineStatusRouter);
  app.use("/api/gprsOnlineStatus", requireAuth, requireCsrf, requireRouteAccess, gprsOnlineStatusRouter);
  app.use("/API/UpdateFirmwareTask", requireAuth, requireCsrf, requireRouteAccess, updateFirmwareTaskRouter);
  app.use("/api/updateFirmwareTask", requireAuth, requireCsrf, requireRouteAccess, updateFirmwareTaskRouter);
  app.use("/API/PrepayReport", requireAuth, requireCsrf, requireRouteAccess, reportRouter);
  app.use("/api/notifications", requireAuth, requireCsrf, requireRouteAccess, notificationRouter);
  app.use("/api/runtime", requireAuth, requireCsrf, requireRouteAccess, runtimeRouter);
  app.use("/api/theft", requireAuth, requireCsrf, requireRouteAccess, theftRouter);
  app.use("/api/documents", requireAuth, requireCsrf, requireRouteAccess, documentRouter);
  app.use("/api/search", requireAuth, requireCsrf, requireRouteAccess, searchRouter);
  app.use("/api/vendor", requireAuth, requireCsrf, requireRouteAccess, requireWalletRouteAccess, vendorRouter);
  app.use("/api/wallet", requireAuth, requireCsrf, requireRouteAccess, requireWalletRouteAccess, walletRouter);
  app.use(
    "/api/reconciliation",
    requireAuth,
    requireCsrf,
    requireRouteAccess,
    requireWalletRouteAccess,
    reconciliationRouter,
  );

  // Endpoint registry still protects this route from unknown paths.
  app.post(/^\/(?:api|API)\//, requireAuth, requireCsrf, requireRouteAccess, proxyHandler);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
