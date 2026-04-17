import { randomUUID } from "node:crypto";
import { persistReceipt } from "./wallet-persistence.js";
import {
  getWalletDomainState,
  nextReceiptNumber,
  nowIso,
  roundMoney,
  type PurchaseDeliveryMethod,
  type WalletReceiptRecord,
} from "./wallet-domain-store.js";

export interface WalletReceiptIssueInput {
  purchaseOrderId: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  siteCode: string;
  issuedBy: string;
  meterSn: string;
  customerRef: string;
  amount: number;
  deliveryMethod: PurchaseDeliveryMethod;
  tokenValue?: string | null;
  remoteSendRef?: string | null;
}

function formatDateTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Africa/Lagos",
  }).format(new Date(timestamp));
}

function buildPrintableContent(input: WalletReceiptIssueInput, receiptNumber: string, issuedAt: string) {
  const header =
    input.deliveryMethod === "remote_send"
      ? "VENDING RECEIPT - REMOTE SEND"
      : "VENDING RECEIPT - TOKEN";

  const lines = [
    "ACOB Lighting Technology Ltd",
    header,
    "",
    `Receipt No: ${receiptNumber}`,
    `Date/Time: ${formatDateTime(issuedAt)}`,
    `Vendor: ${input.vendorName} (${input.vendorCode})`,
    `Site: ${input.siteCode}`,
    "",
    `Meter SN: ${input.meterSn}`,
    `Customer Ref: ${input.customerRef}`,
    `Amount: NGN ${roundMoney(input.amount).toFixed(2)}`,
  ];

  if (input.deliveryMethod === "remote_send") {
    lines.push(`Delivery Ref: ${input.remoteSendRef ?? "PENDING-UPSTREAM-REF"}`);
    lines.push("Status: DELIVERED");
  } else {
    lines.push("");
    lines.push(`TOKEN: ${input.tokenValue ?? "PENDING-TOKEN"}`);
    lines.push("Enter this 20-digit code on the meter keypad.");
  }

  return lines.join("\n");
}

export const walletReceiptService = {
  issueReceipt(input: WalletReceiptIssueInput) {
    const state = getWalletDomainState();
    const issuedAt = nowIso();
    const receipt: WalletReceiptRecord = {
      id: randomUUID(),
      purchaseOrderId: input.purchaseOrderId,
      vendorId: input.vendorId,
      siteCode: input.siteCode,
      deliveryMethod: input.deliveryMethod,
      meterSn: input.meterSn,
      customerRef: input.customerRef,
      amount: roundMoney(input.amount),
      tokenValue: input.tokenValue ?? null,
      remoteSendRef: input.remoteSendRef ?? null,
      issuedAt,
      receiptNumber: nextReceiptNumber(),
      issuedBy: input.issuedBy,
      printableContent: "",
    };

    receipt.printableContent = buildPrintableContent(input, receipt.receiptNumber, issuedAt);
    state.receipts.set(receipt.id, receipt);
    persistReceipt(receipt);

    return receipt;
  },

  getReceipt(receiptId: string) {
    return getWalletDomainState().receipts.get(receiptId) ?? null;
  },

  renderPrintableReceipt(receiptId: string) {
    const receipt = this.getReceipt(receiptId);
    if (!receipt) {
      throw new Error(`Receipt ${receiptId} was not found`);
    }

    return {
      receipt,
      contentType: "text/plain; charset=utf-8",
      content: receipt.printableContent,
    };
  },

  listReceiptsForVendor(vendorId: string) {
    const rows = Array.from(getWalletDomainState().receipts.values())
      .filter((receipt) => receipt.vendorId === vendorId)
      .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt));

    return {
      rows,
      total: rows.length,
    };
  },
};

export function getWalletReceiptService() {
  return walletReceiptService;
}
