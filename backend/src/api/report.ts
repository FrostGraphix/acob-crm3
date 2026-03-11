import { Router } from "express";
import { proxyHandler } from "./proxy.js";

export const reportRouter = Router();

reportRouter.post("/LongNonpurchaseSituation", proxyHandler);
reportRouter.post("/LowPurchaseSituation", proxyHandler);
reportRouter.post("/ConsumptionStatistics", proxyHandler);
