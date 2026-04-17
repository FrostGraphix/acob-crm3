import { Router } from "express";
import { buildCustomer360Lite } from "../services/analytics-mix.js";
import {
  buildCustomerConsumptionRechargeDaily,
  buildCustomerConsumptionRechargeSummary,
  buildCustomerForecasts,
  buildCustomerLiveDailyConsumption,
  buildCustomerSegments,
} from "../services/customer-analytics.js";
import { createBulkImportHandler } from "./bulk-import.js";
import { proxyHandler } from "./proxy.js";
import { sendEnvelope } from "../services/response.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

export const customerRouter = Router();

customerRouter.get("/consumption-recharge-summary", async (request, response) => {
  try {
    const result = await buildCustomerConsumptionRechargeSummary(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load customer summary";
    sendEnvelope(response, 502, null, message, 1);
  }
});

customerRouter.get("/consumption-recharge-daily", async (request, response) => {
  try {
    const result = await buildCustomerConsumptionRechargeDaily(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load customer daily analytics";
    sendEnvelope(response, 502, null, message, 1);
  }
});

customerRouter.get("/live-daily-consumption", async (request, response) => {
  try {
    const result = await buildCustomerLiveDailyConsumption(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load live daily consumption";
    sendEnvelope(response, 502, null, message, 1);
  }
});

customerRouter.get("/segments", async (request, response) => {
  try {
    const result = await buildCustomerSegments(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load customer segments";
    sendEnvelope(response, 502, null, message, 1);
  }
});

customerRouter.get("/forecasts", async (request, response) => {
  try {
    const result = await buildCustomerForecasts(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load customer forecasts";
    sendEnvelope(response, 502, null, message, 1);
  }
});

customerRouter.get("/360-lite", async (request, response) => {
  try {
    const result = await buildCustomer360Lite(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load customer 360";
    sendEnvelope(response, 502, null, message, 1);
  }
});

customerRouter.post("/read", proxyHandler);
customerRouter.post("/create", proxyHandler);
customerRouter.post("/update", proxyHandler);
customerRouter.post("/delete", proxyHandler);
customerRouter.post("/import", createBulkImportHandler("/api/customer/create", "customer"));
