import { Router } from "express";
import { proxyHandler } from "./proxy.js";

export const loadProfileRouter = Router();

loadProfileRouter.post("/ElectricEnergyCurve", proxyHandler);
loadProfileRouter.post("/InstantaneousValueCurve", proxyHandler);
loadProfileRouter.post("/DailyData", proxyHandler);
loadProfileRouter.post("/MonthlyData", proxyHandler);
