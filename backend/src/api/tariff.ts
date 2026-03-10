import { Router } from "express";
import { proxyHandler } from "./proxy.js";

export const tariffRouter = Router();

tariffRouter.post("/read", proxyHandler);
tariffRouter.post("/create", proxyHandler);
tariffRouter.post("/update", proxyHandler);
tariffRouter.post("/delete", proxyHandler);
tariffRouter.post("/import", proxyHandler);
