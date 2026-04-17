import { roundMoney, type PurchaseOrderRecord, type WalletRequestContext } from "./wallet-domain-store.js";

export interface TokenGenerationExecutionResult {
  success: boolean;
  deliveryMethod: "token_generate";
  upstreamEndpoint: "/api/token/creditToken/generate";
  mode: "simulated";
  tokenValue: string | null;
  message: string;
  payload: Record<string, unknown>;
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
