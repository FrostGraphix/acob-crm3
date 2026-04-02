import { Router } from "express";
import { createBulkImportHandler } from "./bulk-import.js";
import { proxyHandler } from "./proxy.js";

export const accountRouter = Router();

accountRouter.post("/read", proxyHandler);
accountRouter.post("/create", proxyHandler);
accountRouter.post("/update", proxyHandler);
accountRouter.post("/delete", proxyHandler);
accountRouter.post("/import", createBulkImportHandler("/api/account/create", "account"));
