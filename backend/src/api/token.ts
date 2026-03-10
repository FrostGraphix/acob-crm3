import { Router } from "express";
import { proxyHandler } from "./proxy.js";

export const tokenRouter = Router();

tokenRouter.post("/creditToken/generate", proxyHandler);
tokenRouter.post("/clearTamperToken/generate", proxyHandler);
tokenRouter.post("/clearCreditToken/generate", proxyHandler);
tokenRouter.post("/setMaxPowerLimitToken/generate", proxyHandler);

tokenRouter.post("/creditTokenRecord/read", proxyHandler);
tokenRouter.post("/clearTamperTokenRecord/read", proxyHandler);
tokenRouter.post("/clearCreditTokenRecord/read", proxyHandler);
tokenRouter.post("/setMaxPowerLimitTokenRecord/read", proxyHandler);
tokenRouter.post("/creditTokenRecord/cancel", proxyHandler);
