import { Router } from "express";
import { createBulkImportHandler } from "./bulk-import.js";
import { proxyHandler } from "./proxy.js";

export const dlt645Router = Router();

dlt645Router.post("/read", proxyHandler);
dlt645Router.post("/readDLT645Tree", proxyHandler);
dlt645Router.post("/create", proxyHandler);
dlt645Router.post("/update", proxyHandler);
dlt645Router.post("/delete", proxyHandler);
dlt645Router.post("/import", createBulkImportHandler("/api/dlt645/create", "dlt645"));
