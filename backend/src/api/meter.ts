import { Router } from "express";
import { proxyHandler } from "./proxy.js";

export const meterRouter = Router();

meterRouter.post("/read", proxyHandler);
