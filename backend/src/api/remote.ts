import { Router } from "express";
import { proxyHandler } from "./proxy.js";

export const remoteRouter = Router();

remoteRouter.post("/CreateReadingTask", proxyHandler);
remoteRouter.post("/CreateSettingTask", proxyHandler);
remoteRouter.post("/CreateControlTask", proxyHandler);
remoteRouter.post("/CreateTokenTask", proxyHandler);
remoteRouter.post("/CreateTransparentForwardingTask", proxyHandler);
remoteRouter.post("/GetReadingTask", proxyHandler);
remoteRouter.post("/GetSettingTask", proxyHandler);
remoteRouter.post("/GetControlTask", proxyHandler);
remoteRouter.post("/GetTokenTask", proxyHandler);
remoteRouter.post("/GetTransparentForwardingTask", proxyHandler);
remoteRouter.post("/UpdateReadingTask", proxyHandler);
remoteRouter.post("/UpdateSettingTask", proxyHandler);
remoteRouter.post("/UpdateControlTask", proxyHandler);
remoteRouter.post("/UpdateTokenTask", proxyHandler);
