import { Router } from "express";
import { proxyHandler } from "./proxy.js";

export const gprsOnlineStatusRouter = Router();

gprsOnlineStatusRouter.post("/Read", proxyHandler);
gprsOnlineStatusRouter.post("/View", proxyHandler);
gprsOnlineStatusRouter.post("/Update", proxyHandler);
