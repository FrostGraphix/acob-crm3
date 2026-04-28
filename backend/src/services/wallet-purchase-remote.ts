import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { executeRemoteTokenSend } from "./remote-token-send.js";
import { roundMoney, type PurchaseOrderRecord, type WalletRequestContext } from "./wallet-domain-store.js";

export interface RemoteSendExecutionResult {
  success: boolean;
  deliveryMethod: "remote_send";
  upstreamEndpoint: "/API/RemoteMeterTask/CreateTokenTask" | "/API/GPRSMeterTask/GPRSCreateTokenTask";
  mode: "live" | "blocked";
  remoteSendRef: string | null;
  tokenValue?: string | null;
  message: string;
  payload: Record<string, unknown>;
}

export const walletPurchaseRemoteService = {
  async execute(
    context: WalletRequestContext,
    order: PurchaseOrderRecord,
    request?: AuthenticatedRequest,
    response?: Response,
  ): Promise<RemoteSendExecutionResult> {
    if (!request || !response) {
      return {
        success: false,
        deliveryMethod: "remote_send",
        upstreamEndpoint: "/API/RemoteMeterTask/CreateTokenTask",
        mode: "blocked",
        remoteSendRef: null,
        message: "Remote-send requires an authenticated HTTP request context for upstream delivery",
        payload: {
          vendorId: order.vendorId,
          siteCode: order.siteCode,
          actorUserId: context.actorUserId,
          amount: roundMoney(order.amount),
        },
      };
    }

    try {
      const result = await executeRemoteTokenSend(request, response, {
        row: {
          meterId: order.meterSn,
          MeterId: order.meterSn,
          meterNo: order.meterSn,
          customerId: order.customerRef,
          CustomerId: order.customerRef,
          customerName: order.customerRef,
          stationId: order.siteCode,
          StationId: order.siteCode,
          siteId: order.siteCode,
        },
        operation: "send-credit",
        loadMode: "naira",
        amount: roundMoney(order.amount),
      });
      const details = result.details as Record<string, unknown>;
      const deliveryPath =
        details.deliveryPath === "/API/GPRSMeterTask/GPRSCreateTokenTask"
          ? "/API/GPRSMeterTask/GPRSCreateTokenTask"
          : "/API/RemoteMeterTask/CreateTokenTask";

      return {
        success: result.success,
        deliveryMethod: "remote_send",
        upstreamEndpoint: deliveryPath,
        mode: "live",
        remoteSendRef: typeof details.remoteSendRef === "string" ? details.remoteSendRef : null,
        tokenValue: typeof details.tokenValue === "string" ? details.tokenValue : null,
        message: result.message,
        payload: {
          ...details,
          vendorId: order.vendorId,
          walletId: order.walletId,
          purchaseOrderId: order.id,
        },
      };
    } catch (error) {
      return {
        success: false,
        deliveryMethod: "remote_send",
        upstreamEndpoint: "/API/RemoteMeterTask/CreateTokenTask",
        mode: "live",
        remoteSendRef: null,
        message: error instanceof Error ? error.message : "Remote-send delivery failed",
        payload: {
          vendorId: order.vendorId,
          siteCode: order.siteCode,
          actorUserId: context.actorUserId,
          amount: roundMoney(order.amount),
        },
      };
    }

  },
};

export function getWalletPurchaseRemoteService() {
  return walletPurchaseRemoteService;
}
