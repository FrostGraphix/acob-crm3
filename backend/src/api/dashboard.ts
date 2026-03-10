import { Router } from "express";
import { proxyHandler } from "./proxy.js";

export const dashboardRouter = Router();

dashboardRouter.post("/readPanelGroup", proxyHandler);
dashboardRouter.post("/readLineChart", proxyHandler);
