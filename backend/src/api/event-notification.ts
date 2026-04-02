import { Router } from "express";
import { proxyHandler } from "./proxy.js";

export const eventNotificationRouter = Router();

eventNotificationRouter.post("/Read", proxyHandler);
