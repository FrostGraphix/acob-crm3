import { Router } from "express";
import { createBulkImportHandler } from "./bulk-import.js";
import { proxyHandler } from "./proxy.js";

export const debtRouter = Router();

debtRouter.post("/read", proxyHandler);
debtRouter.post("/create", proxyHandler);
debtRouter.post("/update", proxyHandler);
debtRouter.post("/delete", proxyHandler);
debtRouter.post("/import", createBulkImportHandler("/api/debt/create", "debt"));
