import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { buildTokenReconciliation } from "../services/analytics-mix.js";
import { executeRemoteTokenSend } from "../services/remote-token-send.js";
import { sendEnvelope } from "../services/response.js";
import { readCombinedTaskGroup, updateTaskGroup } from "../services/task-monitor.js";
import {
  applyWalletSiteScopeToBody,
  buildWalletPurchaseInputFromCrm,
  createWalletCrmContext,
  flattenWalletPurchaseForCrm,
  isWalletScopedCrmContext,
} from "../services/wallet-crm-link.js";
import { getWalletPurchaseService } from "../services/wallet-purchase.js";
import { proxyCanonicalPath, proxyHandler } from "./proxy.js";

export const tokenRouter = Router();

function readTokenBody(body: unknown) {
  return typeof body === "object" && body !== null
    ? (body as Record<string, unknown>)
    : {};
}

function readTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

async function proxyScopedTokenPath(
  request: AuthenticatedRequest,
  response: Response,
  pathname: string,
) {
  const body = readTokenBody(request.body);
  const context = createWalletCrmContext(request, body);
  return proxyCanonicalPath(
    request,
    response,
    pathname,
    applyWalletSiteScopeToBody(body, context),
  );
}

tokenRouter.post("/remote-send", async (request, response) => {
  try {
    const body = readTokenBody(request.body);
    const walletContext = createWalletCrmContext(request as AuthenticatedRequest, body);
    if (isWalletScopedCrmContext(walletContext)) {
      const purchaseInput = buildWalletPurchaseInputFromCrm(body, walletContext, "remote_send");
      const walletResult = await getWalletPurchaseService().purchaseRemoteSend(
        walletContext,
        purchaseInput,
        request as AuthenticatedRequest,
        response,
      );
      const flattened = flattenWalletPurchaseForCrm(walletResult);
      sendEnvelope(
        response,
        walletResult.receipt ? 200 : 202,
        flattened,
        walletResult.receipt ? "Remote-send wallet purchase completed" : "Remote-send wallet purchase requires follow-up",
      );
      return;
    }

    const operation =
      body.operation === "clear-credit" ? "clear-credit" : "send-credit";
    const loadMode =
      body.loadMode === "unit" ? "unit" : "naira";
    const amount =
      typeof body.amount === "number"
        ? body.amount
        : typeof body.amount === "string" && body.amount.trim().length > 0
          ? Number(body.amount)
          : undefined;

    const result = await executeRemoteTokenSend(
      request as AuthenticatedRequest,
      response,
      {
        row:
          typeof body.row === "object" && body.row !== null
            ? (body.row as Record<string, unknown>)
            : undefined,
        operation,
        loadMode,
        amount,
        taskName: readTrimmedString(body.taskName),
        scheduleDate: readTrimmedString(body.scheduleDate),
        operatorReason: readTrimmedString(body.operatorReason),
      },
    );

    sendEnvelope(response, 200, result, result.message);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Remote token delivery failed";
    sendEnvelope(response, 502, null, message, 1);
  }
});

tokenRouter.post("/remote-task/read", async (request, response) => {
  try {
    const body = typeof request.body === "object" && request.body !== null
      ? (request.body as Record<string, unknown>)
      : {};
    const result = await readCombinedTaskGroup(
      request as AuthenticatedRequest,
      response,
      "token",
      body,
    );
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load remote token tasks";
    sendEnvelope(response, 502, null, message, 1);
  }
});

tokenRouter.post("/remote-task/update", async (request, response) => {
  try {
    const body = typeof request.body === "object" && request.body !== null
      ? (request.body as Record<string, unknown>)
      : {};
    const upstreamResult = await updateTaskGroup(
      request as AuthenticatedRequest,
      response,
      "token",
      body,
    );

    sendEnvelope(
      response,
      upstreamResult.statusCode < 400 && upstreamResult.payload.code === 0 ? 200 : 502,
      upstreamResult.payload.result,
      upstreamResult.payload.reason || "success",
      upstreamResult.payload.code,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update remote token task";
    sendEnvelope(response, 502, null, message, 1);
  }
});

tokenRouter.get("/reconciliation", async (request, response) => {
  try {
    const result = await buildTokenReconciliation(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load token reconciliation";
    sendEnvelope(response, 502, null, message, 1);
  }
});

// Credit Token
tokenRouter.post("/creditToken/generate", async (request, response) => {
  try {
    const body = readTokenBody(request.body);
    const walletContext = createWalletCrmContext(request as AuthenticatedRequest, body);
    if (!isWalletScopedCrmContext(walletContext)) {
      await proxyScopedTokenPath(
        request as AuthenticatedRequest,
        response,
        "/api/token/creditToken/generate",
      );
      return;
    }

    const purchaseInput = buildWalletPurchaseInputFromCrm(body, walletContext, "token_generate");
    const walletResult = await getWalletPurchaseService().purchaseGenerateToken(
      walletContext,
      purchaseInput,
      request as AuthenticatedRequest,
      response,
      body,
    );
    const flattened = flattenWalletPurchaseForCrm(walletResult);
    sendEnvelope(
      response,
      walletResult.receipt ? 200 : 202,
      flattened,
      walletResult.receipt ? "Token wallet purchase completed" : "Token wallet purchase requires follow-up",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate wallet-linked token";
    sendEnvelope(response, 400, null, message, 1);
  }
});
tokenRouter.post("/creditTokenRecord/read", (request, response) =>
  proxyScopedTokenPath(request as AuthenticatedRequest, response, "/api/token/creditTokenRecord/read"));
tokenRouter.post("/creditTokenRecord/readMore", (request, response) =>
  proxyScopedTokenPath(request as AuthenticatedRequest, response, "/api/token/creditTokenRecord/readMore"));
tokenRouter.post("/creditTokenRecord/cancel", (request, response) =>
  proxyScopedTokenPath(request as AuthenticatedRequest, response, "/api/token/creditTokenRecord/cancel"));
tokenRouter.post("/creditTokenCancelRecord/read", (request, response) =>
  proxyScopedTokenPath(request as AuthenticatedRequest, response, "/api/token/creditTokenCancelRecord/read"));

// Clear Tamper Token
tokenRouter.post("/clearTamperToken/generate", (request, response) =>
  proxyScopedTokenPath(request as AuthenticatedRequest, response, "/api/token/clearTamperToken/generate"));
tokenRouter.post("/clearTamperTokenRecord/read", (request, response) =>
  proxyScopedTokenPath(request as AuthenticatedRequest, response, "/api/token/clearTamperTokenRecord/read"));

// Clear Credit Token
tokenRouter.post("/clearCreditToken/generate", (request, response) =>
  proxyScopedTokenPath(request as AuthenticatedRequest, response, "/api/token/clearCreditToken/generate"));
tokenRouter.post("/clearCreditTokenRecord/read", (request, response) =>
  proxyScopedTokenPath(request as AuthenticatedRequest, response, "/api/token/clearCreditTokenRecord/read"));

// Set Maximum Power Limit Token
tokenRouter.post("/setMaximumPowerLimitToken/generate", (request, response) =>
  proxyScopedTokenPath(request as AuthenticatedRequest, response, "/api/token/setMaximumPowerLimitToken/generate"));
tokenRouter.post("/setMaximumPowerLimitTokenRecord/read", (request, response) =>
  proxyScopedTokenPath(request as AuthenticatedRequest, response, "/api/token/setMaximumPowerLimitTokenRecord/read"));

// Set Maximum Phase Power Unbalance Limit Token
tokenRouter.post("/setMaximumPhasePowerUnbalanceLimitToken/generate", (request, response) =>
  proxyScopedTokenPath(request as AuthenticatedRequest, response, "/api/token/setMaximumPhasePowerUnbalanceLimitToken/generate"));
tokenRouter.post("/setMaximumPhasePowerUnbalanceLimitTokenRecord/read", (request, response) =>
  proxyScopedTokenPath(request as AuthenticatedRequest, response, "/api/token/setMaximumPhasePowerUnbalanceLimitTokenRecord/read"));

// Meter Test Token
tokenRouter.post("/meterTestToken/read", (request, response) =>
  proxyScopedTokenPath(request as AuthenticatedRequest, response, "/api/token/meterTestToken/read"));

// Meter Key
tokenRouter.post("/meterKey/update", (request, response) =>
  proxyScopedTokenPath(request as AuthenticatedRequest, response, "/api/token/meterKey/update"));

// Change Meter Key Token
tokenRouter.post("/changeMeterKeyToken/generate", (request, response) =>
  proxyScopedTokenPath(request as AuthenticatedRequest, response, "/api/token/changeMeterKeyToken/generate"));
tokenRouter.post("/changeMeterKeyTokenRecord/read", (request, response) =>
  proxyScopedTokenPath(request as AuthenticatedRequest, response, "/api/token/changeMeterKeyTokenRecord/read"));

// Set Maximum Overdraft Limit Token
tokenRouter.post("/setMaximumOverdraftLimitToken/generate", (request, response) =>
  proxyScopedTokenPath(request as AuthenticatedRequest, response, "/api/token/setMaximumOverdraftLimitToken/generate"));
tokenRouter.post("/setMaximumOverdraftLimitTokenRecord/read", (request, response) =>
  proxyScopedTokenPath(request as AuthenticatedRequest, response, "/api/token/setMaximumOverdraftLimitTokenRecord/read"));

