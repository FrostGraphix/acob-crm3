import { Router } from "express";
import { proxyHandler } from "./proxy.js";

export const customerRouter = Router();

customerRouter.post("/read", proxyHandler);
customerRouter.post("/create", proxyHandler);
customerRouter.post("/update", proxyHandler);
customerRouter.post("/delete", proxyHandler);
customerRouter.post("/import", proxyHandler);
