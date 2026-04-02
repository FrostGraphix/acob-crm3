import { Router } from "express";
import { proxyHandler } from "./proxy.js";

export const fileUploadRouter = Router();

fileUploadRouter.post("/Upload", proxyHandler);
fileUploadRouter.post("/UploadBin", proxyHandler);
fileUploadRouter.post("/ConcentratorUploadBin", proxyHandler);
