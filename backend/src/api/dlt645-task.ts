import { Router } from "express";
import { proxyHandler } from "./proxy.js";

export const dlt645TaskRouter = Router();

dlt645TaskRouter.post("/read", proxyHandler);
