import { roundMoney, type PurchaseOrderRecord, type WalletRequestContext } from "./wallet-domain-store.js";

export interface RemoteSendExecutionResult {
  success: boolean;
  deliveryMethod: "remote_send";
  upstreamEndpoint: "/API/RemoteMeterTask/CreateTokenTask";
  mode: "simulated";
  remoteSendRef: string | null;
  message: string;
  payload: Record<string, unknown>;
}

function shouldSimulateFailure(order: PurchaseOrderRecord) {
  return (
    order.meterSn.toUpperCase().includes("UPSTREAMFAIL") ||
    order.customerRef.toUpperCase().includes("UPSTREAMFAIL")
  );
}

export const walletPurchaseRemoteService = {
  async execute(
    context: WalletRequestContext,
    order: PurchaseOrderRecord,
  ): Promise<RemoteSendExecutionResult> {
    if (shouldSimulateFailure(order)) {
      return {
        success: false,
        deliveryMethod: "remote_send",
        upstreamEndpoint: "/API/RemoteMeterTask/CreateTokenTask",
        mode: "simulated",
        remoteSendRef: null,
        message: "Simulated upstream remote-send failure for scaffold testing",
        payload: {
          vendorId: order.vendorId,
          siteCode: order.siteCode,
          actorUserId: context.actorUserId,
          amount: roundMoney(order.amount),
        },
      };
    }

    const remoteSendRef = `RMT-${order.id.slice(0, 8).toUpperCase()}`;
    return {
      success: true,
      deliveryMethod: "remote_send",
      upstreamEndpoint: "/API/RemoteMeterTask/CreateTokenTask",
      mode: "simulated",
      remoteSendRef,
      message: "Remote-send scaffold completed with simulated upstream delivery",
      payload: {
        taskType: "remote_send",
        amount: roundMoney(order.amount),
        meterSn: order.meterSn,
        vendorId: order.vendorId,
      },
    };
  },
};

export function getWalletPurchaseRemoteService() {
  return walletPurchaseRemoteService;
}
