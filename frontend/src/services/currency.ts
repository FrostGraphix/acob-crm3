const currencyColumnKeys = new Set([
  "amount",
  "balance",
  "creditBalance",
  "debtAmount",
  "lowAmount",
  "maximumOverdraftLimit",
  "price",
  "purchaseMoney",
  "purchaseTotalPaid",
  "remainingBalance",
  "surplusAmount",
  "tariffPrice",
  "totalPaid",
  "totalPrice",
  "totalPurchaseMoney",
  "vatCharge",
]);

export function formatNaira(value: number, options?: { maximumFractionDigits?: number }) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(value);
}

export function formatNairaCompact(value: number, fractionDigits = 0) {
  return `\u20A6${new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(value)}`;
}

export function formatNumber(value: number, options?: { maximumFractionDigits?: number }) {
  return new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(value);
}

export function isCurrencyColumnKey(columnKey: string) {
  return currencyColumnKeys.has(columnKey);
}

export function normalizeNairaLabel(value: string) {
  return value.replace(/^NGN\s*/i, "\u20A6").replace(/^N(?=\d)/, "\u20A6");
}
