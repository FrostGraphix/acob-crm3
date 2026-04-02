import { Router } from "express";
import { proxyHandler } from "./proxy.js";

export const tokenRouter = Router();

// Credit Token
tokenRouter.post("/creditToken/generate", proxyHandler);
tokenRouter.post("/creditTokenRecord/read", proxyHandler);
tokenRouter.post("/creditTokenRecord/readMore", proxyHandler);
tokenRouter.post("/creditTokenRecord/cancel", proxyHandler);
tokenRouter.post("/creditTokenCancelRecord/read", proxyHandler);

// Clear Tamper Token
tokenRouter.post("/clearTamperToken/generate", proxyHandler);
tokenRouter.post("/clearTamperTokenRecord/read", proxyHandler);

// Clear Credit Token
tokenRouter.post("/clearCreditToken/generate", proxyHandler);
tokenRouter.post("/clearCreditTokenRecord/read", proxyHandler);

// Set Maximum Power Limit Token
tokenRouter.post("/setMaximumPowerLimitToken/generate", proxyHandler);
tokenRouter.post("/setMaximumPowerLimitTokenRecord/read", proxyHandler);

// Set Maximum Phase Power Unbalance Limit Token
tokenRouter.post("/setMaximumPhasePowerUnbalanceLimitToken/generate", proxyHandler);
tokenRouter.post("/setMaximumPhasePowerUnbalanceLimitTokenRecord/read", proxyHandler);

// Meter Test Token
tokenRouter.post("/meterTestToken/read", proxyHandler);

// Meter Key
tokenRouter.post("/meterKey/update", proxyHandler);

// Change Meter Key Token
tokenRouter.post("/changeMeterKeyToken/generate", proxyHandler);
tokenRouter.post("/changeMeterKeyTokenRecord/read", proxyHandler);

// Set Maximum Overdraft Limit Token
tokenRouter.post("/setMaximumOverdraftLimitToken/generate", proxyHandler);
tokenRouter.post("/setMaximumOverdraftLimitTokenRecord/read", proxyHandler);
