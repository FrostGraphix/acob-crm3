import { Router } from "express";
import { proxyHandler } from "./proxy.js";

export const gprsMeterTaskRouter = Router();

gprsMeterTaskRouter.post("/GPRSCreateReadingTask", proxyHandler);
gprsMeterTaskRouter.post("/GPRSCreateSettingTask", proxyHandler);
gprsMeterTaskRouter.post("/GPRSCreateControlTask", proxyHandler);
gprsMeterTaskRouter.post("/GPRSCreateTokenTask", proxyHandler);
gprsMeterTaskRouter.post("/GPRSGetReadingTask", proxyHandler);
gprsMeterTaskRouter.post("/GPRSGetSettingTask", proxyHandler);
gprsMeterTaskRouter.post("/GPRSGetControlTask", proxyHandler);
gprsMeterTaskRouter.post("/GPRSGetTokenTask", proxyHandler);
gprsMeterTaskRouter.post("/GPRSUpdateReadingTask", proxyHandler);
gprsMeterTaskRouter.post("/GPRSUpdateSettingTask", proxyHandler);
gprsMeterTaskRouter.post("/GPRSUpdateControlTask", proxyHandler);
gprsMeterTaskRouter.post("/GPRSUpdateTokenTask", proxyHandler);
