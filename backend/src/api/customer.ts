import { Router } from "express";
import { createBulkImportHandler } from "./bulk-import.js";
import { proxyHandler } from "./proxy.js";

export const customerRouter = Router();

customerRouter.post("/read", proxyHandler);
customerRouter.post("/create", proxyHandler);
customerRouter.post("/update", proxyHandler);
customerRouter.post("/delete", proxyHandler);
customerRouter.post("/import", createBulkImportHandler("/api/customer/create", "customer"));
