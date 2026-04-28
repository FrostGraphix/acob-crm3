import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { applyWalletSiteScopeToBody, createWalletCrmContext } from "../services/wallet-crm-link.js";
import { createBulkImportHandler } from "./bulk-import.js";
import { proxyCanonicalPath, proxyHandler } from "./proxy.js";

export const tariffRouter = Router();

tariffRouter.post("/read", (request, response) => {
  const body = typeof request.body === "object" && request.body !== null
    ? (request.body as Record<string, unknown>)
    : {};
  const context = createWalletCrmContext(request as AuthenticatedRequest, body);
  return proxyCanonicalPath(
    request,
    response,
    "/api/tariff/read",
    applyWalletSiteScopeToBody(body, context),
  );
});
tariffRouter.post("/create", proxyHandler);
tariffRouter.post("/update", proxyHandler);
tariffRouter.post("/delete", proxyHandler);
tariffRouter.post("/import", createBulkImportHandler("/api/tariff/import", "tariff"));
