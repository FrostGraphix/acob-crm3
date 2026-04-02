import { Router } from "express";
import { createBulkImportHandler } from "./bulk-import.js";
import { proxyHandler } from "./proxy.js";

export const dlmsRouter = Router();

dlmsRouter.post("/Read", proxyHandler);
dlmsRouter.post("/ReadDLMSTree", proxyHandler);
dlmsRouter.post("/Create", proxyHandler);
dlmsRouter.post("/Update", proxyHandler);
dlmsRouter.post("/Delete", proxyHandler);
dlmsRouter.post("/Import", createBulkImportHandler("/api/dlms/Create", "dlms"));
