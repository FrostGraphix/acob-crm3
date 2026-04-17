import { Router } from "express";
import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { proxyHandler } from "./proxy.js";
import { sendEnvelope } from "../services/response.js";
import {
  buildDashboardPortfolioHealth,
  buildDashboardRevenueVsUsage,
  buildDashboardRiskOverlay,
} from "../services/analytics-mix.js";
import { loadDashboardAggregate, loadDashboardLineChart } from "../services/dashboard-service.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", async (request: Request, response: Response) => {
  try {
    const result = await loadDashboardAggregate(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard";
    sendEnvelope(response, 502, null, message, 1);
  }
});

dashboardRouter.get("/risk-overlay", async (request: Request, response: Response) => {
  try {
    const result = await buildDashboardRiskOverlay(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard risk overlay";
    sendEnvelope(response, 502, null, message, 1);
  }
});

dashboardRouter.get("/revenue-vs-usage", async (request: Request, response: Response) => {
  try {
    const result = await buildDashboardRevenueVsUsage(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard revenue mix";
    sendEnvelope(response, 502, null, message, 1);
  }
});

dashboardRouter.get("/portfolio-health", async (request: Request, response: Response) => {
  try {
    const result = await buildDashboardPortfolioHealth(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load portfolio health";
    sendEnvelope(response, 502, null, message, 1);
  }
});

dashboardRouter.post("/readLineChart", async (request: Request, response: Response) => {
  try {
    const result = await loadDashboardLineChart(
      request as AuthenticatedRequest,
      response,
      typeof request.body === "object" && request.body !== null
        ? (request.body as Record<string, unknown>)
        : {},
    );
    sendEnvelope(response, 200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard line chart";
    sendEnvelope(response, 502, { xData: [], yData: [] }, message, 1);
  }
});

dashboardRouter.post("/readPanelGroup", proxyHandler);
