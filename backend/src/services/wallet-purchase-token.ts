import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { buildUpstreamRequestPlan } from "./upstream-request-adapters.js";
import { forwardWithUpstreamSessionRecovery } from "./upstream-session.js";
import { forwardToUpstream, type UpstreamResult } from "./upstream.js";
import { roundMoney, type PurchaseOrderRecord, type WalletRequestContext } from "./wallet-domain-store.js";

export interface TokenGenerationExecutionResult {
  success: boolean;
  deliveryMethod: "token_generate";
  upstreamEndpoint: "/api/token/creditToken/generate";
  mode: "live" | "simulated";
  tokenValue: string | null;
  message: string;
  payload: Record<string, unknown>;
}

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function readString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function extractTokenValue(result: unknown): string | null {
  if (typeof result === "string" && result.trim().length > 0) {
    return result.trim();
  }

  const root = asRecord(result);
  const direct = readString(root, ["token", "tokenValue", "tokenRecharge", "creditToken", "data"]);
  if (direct) {
    return direct;
  }

  for (const key of ["row", "record", "data", "result"]) {
    if (root[key] !== undefined) {
      const nested = extractTokenValue(root[key]);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

async function forwardTokenGenerate(
  request: AuthenticatedRequest,
  response: Response,
  body: Record<string, unknown>,
) {
  const path = "/api/token/creditToken/generate";
  const plan = buildUpstreamRequestPlan(path, body);

  return forwardWithUpstreamSessionRecovery(
    request,
    response,
    async (upstreamCookie) => {
      let lastResult: UpstreamResult = {
        statusCode: 500,
        payload: {
          code: 1,
          reason: "No upstream candidate bodies provided",
          result: null,
        },
      };

      for (const candidate of plan.candidateBodies) {
        lastResult = await forwardToUpstream(path, candidate, upstreamCookie, {
          timeoutMs: plan.timeoutMs,
        });
        if (lastResult.statusCode < 400 && lastResult.payload.code === 0) {
          return lastResult;
        }
      }

      return lastResult;
    },
  );
}

function shouldSimulateFailure(order: PurchaseOrderRecord) {
  return (
    order.meterSn.toUpperCase().includes("UPSTREAMFAIL") ||
    order.customerRef.toUpperCase().includes("UPSTREAMFAIL")
  );
}

function createTokenValue(seed: string) {
  const digits = seed.replace(/\D/g, "").padEnd(20, "7").slice(0, 20);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

export const walletPurchaseTokenService = {
  async execute(
    context: WalletRequestContext,
    order: PurchaseOrderRecord,
    request?: AuthenticatedRequest,
    response?: Response,
    originalPayload: Record<string, unknown> = {},
  ): Promise<TokenGenerationExecutionResult> {
    if (shouldSimulateFailure(order)) {
      return {
        success: false,
        deliveryMethod: "token_generate",
        upstreamEndpoint: "/api/token/creditToken/generate",
        mode: "simulated",
        tokenValue: null,
        message: "Simulated token generation failure for scaffold testing",
        payload: {
          actorUserId: context.actorUserId,
          vendorId: order.vendorId,
          amount: roundMoney(order.amount),
        },
      };
    }

    if (request && response) {
      const row = asRecord(originalPayload.row);
      const upstreamResult = await forwardTokenGenerate(request, response, {
        ...originalPayload,
        row: {
          ...row,
          meterId: row.meterId ?? order.meterSn,
          MeterId: row.MeterId ?? order.meterSn,
          customerId: row.customerId ?? order.customerRef,
          CustomerId: row.CustomerId ?? order.customerRef,
          stationId: row.stationId ?? order.siteCode,
          StationId: row.StationId ?? order.siteCode,
        },
        meterId: originalPayload.meterId ?? order.meterSn,
        MeterId: originalPayload.MeterId ?? order.meterSn,
        customerId: originalPayload.customerId ?? order.customerRef,
        CustomerId: originalPayload.CustomerId ?? order.customerRef,
        stationId: originalPayload.stationId ?? order.siteCode,
        StationId: originalPayload.StationId ?? order.siteCode,
        amount: originalPayload.amount ?? order.amount,
        Amount: originalPayload.Amount ?? order.amount,
      });
      const tokenValue = extractTokenValue(upstreamResult.payload.result);
      const success = upstreamResult.statusCode < 400 && upstreamResult.payload.code === 0 && Boolean(tokenValue);

      return {
        success,
        deliveryMethod: "token_generate",
        upstreamEndpoint: "/api/token/creditToken/generate",
        mode: "live",
        tokenValue,
        message: success
          ? "Token generated and linked to wallet purchase"
          : upstreamResult.payload.reason || "Token generation failed",
        payload: {
          result: upstreamResult.payload.result,
          statusCode: upstreamResult.statusCode,
          reason: upstreamResult.payload.reason,
          actorUserId: context.actorUserId,
          vendorId: order.vendorId,
          amount: roundMoney(order.amount),
          meterSn: order.meterSn,
        },
      };
    }

    return {
      success: true,
      deliveryMethod: "token_generate",
      upstreamEndpoint: "/api/token/creditToken/generate",
      mode: "simulated",
      tokenValue: createTokenValue(`${order.id}${Math.round(order.amount * 100)}`),
      message: "Token generation scaffold completed with simulated upstream token",
      payload: {
        tokenType: "credit",
        amount: roundMoney(order.amount),
        meterSn: order.meterSn,
        vendorId: order.vendorId,
      },
    };
  },
};

export function getWalletPurchaseTokenService() {
  return walletPurchaseTokenService;
}
