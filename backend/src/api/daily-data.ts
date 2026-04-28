import { Router } from "express";
import { proxyHandler } from "./proxy.js";

export const dailyDataRouter = Router();

dailyDataRouter.post("/read", proxyHandler);
dailyDataRouter.post("/readMore", proxyHandler);
dailyDataRouter.post("/readMonthly", proxyHandler);
