import { Router } from "express";
import { createBulkImportHandler } from "./bulk-import.js";
import { proxyHandler } from "./proxy.js";

export const roleRouter = Router();

roleRouter.post("/read", proxyHandler);
roleRouter.post("/ReadDataRole", proxyHandler);
roleRouter.post("/create", proxyHandler);
roleRouter.post("/update", proxyHandler);
roleRouter.post("/delete", proxyHandler);
roleRouter.post("/import", createBulkImportHandler("/api/role/import", "role"));
