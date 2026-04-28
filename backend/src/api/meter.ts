import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { buildMeterPerformanceSheet } from "../services/analytics-mix.js";
import { sendEnvelope } from "../services/response.js";
import { createBulkImportHandler } from "./bulk-import.js";
import { proxyHandler } from "./proxy.js";

export const meterRouter = Router();

meterRouter.get("/performance-sheet", async (request, response) => {
  try {
    const result = await buildMeterPerformanceSheet(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load meter performance";
    sendEnvelope(response, 502, null, message, 1);
  }
});

meterRouter.post("/read", proxyHandler);
meterRouter.post("/addread", proxyHandler);
meterRouter.post("/create", proxyHandler);
meterRouter.post("/update", proxyHandler);
meterRouter.post("/delete", proxyHandler);
meterRouter.post("/import", createBulkImportHandler("/api/meter/import", "meter"));
