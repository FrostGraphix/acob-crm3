import { Router } from "express";
import { createBulkImportHandler } from "./bulk-import.js";
import { proxyHandler } from "./proxy.js";

export const tariffRouter = Router();

tariffRouter.post("/read", proxyHandler);
tariffRouter.post("/create", proxyHandler);
tariffRouter.post("/update", proxyHandler);
tariffRouter.post("/delete", proxyHandler);
tariffRouter.post("/import", createBulkImportHandler("/api/tariff/create", "tariff"));
