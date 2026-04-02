import { Router } from "express";
import { proxyHandler } from "./proxy.js";

export const logRouter = Router();

logRouter.post("/read", proxyHandler);
