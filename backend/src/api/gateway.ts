import { Router } from "express";
import { createBulkImportHandler } from "./bulk-import.js";
import { proxyHandler } from "./proxy.js";

export const gatewayRouter = Router();

gatewayRouter.post("/read", proxyHandler);
gatewayRouter.post("/create", proxyHandler);
gatewayRouter.post("/update", proxyHandler);
gatewayRouter.post("/delete", proxyHandler);
gatewayRouter.post("/import", createBulkImportHandler("/api/gateway/create", "gateway"));
