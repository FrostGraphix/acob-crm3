import { Router } from "express";
import { createBulkImportHandler } from "./bulk-import.js";
import { proxyHandler } from "./proxy.js";

export const meterRouter = Router();

meterRouter.post("/read", proxyHandler);
meterRouter.post("/addread", proxyHandler);
meterRouter.post("/create", proxyHandler);
meterRouter.post("/update", proxyHandler);
meterRouter.post("/delete", proxyHandler);
meterRouter.post("/import", createBulkImportHandler("/api/meter/create", "meter"));
