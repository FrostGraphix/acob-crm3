import { Router } from "express";
import { proxyHandler } from "./proxy.js";

export const remoteRouter = Router();

remoteRouter.post("/CreateReadingTask", proxyHandler);
remoteRouter.post("/CreateControlTask", proxyHandler);
remoteRouter.post("/CreateTokenTask", proxyHandler);
remoteRouter.post("/GetReadingTask", proxyHandler);
remoteRouter.post("/GetControlTask", proxyHandler);
remoteRouter.post("/GetTokenTask", proxyHandler);
remoteRouter.post("/UpdateReadingTask", proxyHandler);
remoteRouter.post("/UpdateControlTask", proxyHandler);
remoteRouter.post("/UpdateTokenTask", proxyHandler);
