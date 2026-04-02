import { Router } from "express";
import { createBulkImportHandler } from "./bulk-import.js";
import { proxyHandler } from "./proxy.js";

export const itemRouter = Router();

itemRouter.post("/read", proxyHandler);
itemRouter.post("/readItemList", proxyHandler);
itemRouter.post("/create", proxyHandler);
itemRouter.post("/update", proxyHandler);
itemRouter.post("/delete", proxyHandler);
itemRouter.post("/import", createBulkImportHandler("/api/item/create", "item"));
