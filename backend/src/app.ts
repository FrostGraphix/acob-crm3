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
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: "http://localhost:5173",
      credentials: true,
    }),
  );
  app.use(morgan("combined"));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(rateLimitMiddleware);

  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      service: "acob-crm3-backend",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/user", authRouter);
  app.use("/api/dashboard", requireAuth, dashboardRouter);
  app.use("/api/account", requireAuth, accountRouter);
  app.use("/api/customer", requireAuth, customerRouter);
  app.use("/api/tariff", requireAuth, tariffRouter);
  app.use("/api/gateway", requireAuth, gatewayRouter);
  app.use("/api/meter", requireAuth, meterRouter);
  app.use("/api/token", requireAuth, tokenRouter);
  app.use("/api/DailyDataMeter", requireAuth, dailyDataMeterRouter);
  app.use("/API/RemoteMeterTask", requireAuth, remoteRouter);
  app.use("/API/PrepayReport", requireAuth, reportRouter);

  // Endpoint registry still protects this route from unknown paths.
  app.post(/^\/(?:api|API)\//, requireAuth, proxyHandler);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
