import { Router } from "express";
import { createBulkImportHandler } from "./bulk-import.js";
import { proxyHandler } from "./proxy.js";

export const stationRouter = Router();

stationRouter.post("/read", proxyHandler);
stationRouter.post("/create", proxyHandler);
stationRouter.post("/update", proxyHandler);
stationRouter.post("/delete", proxyHandler);
stationRouter.post("/import", createBulkImportHandler("/api/station/import", "station"));
