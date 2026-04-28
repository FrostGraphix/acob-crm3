import { Router } from "express";
import { proxyHandler } from "./proxy.js";

export const updateFirmwareTaskRouter = Router();

updateFirmwareTaskRouter.post("/GetUpdateFirmwareTask", proxyHandler);
updateFirmwareTaskRouter.post("/CreateUpdateFirmwareTask", proxyHandler);
