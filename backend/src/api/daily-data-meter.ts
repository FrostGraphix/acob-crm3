import { Router } from "express";
import { proxyHandler } from "./proxy.js";

export const dailyDataMeterRouter = Router();

dailyDataMeterRouter.post("/read", proxyHandler);
dailyDataMeterRouter.post("/readHourly", proxyHandler);
dailyDataMeterRouter.post("/readMonthly", proxyHandler);
