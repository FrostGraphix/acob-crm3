import type { DataRow } from "../types";

export type RechargeEntryMode = "naira" | "unit";

export interface TariffRateResolution {
  tariffId: string | null;
  tariffName: string | null;
  pricePerUnit: number | null;
  source: "tariff" | "row" | "unknown";
}

export interface RechargeQuote {
  entryMode: RechargeEntryMode;
  entryValue: number;
  units: number;
  amountNaira: number | null;
  pricePerUnit: number | null;
}

export interface CreditTokenOptions {
  isPreview: boolean;
  isVendByTotalPaid: boolean;
  payDebtPercent: number | null;
  isS2: boolean;
}

export interface CreditTokenFormState {
  paymentMethod: string;
  quotaEnabled: boolean;
  quotaValue: number | null;
  remark: string;
}

export interface CreditTokenContext {
  customerId: string | null;
  customerName: string | null;
  meterId: string | null;
  meterType: string | null;
  tariffId: string | null;
  stationId: string | null;
  totalDebt: number | null;
  monthlyCharge: number | null;
  sts: Record<string, string | null>;
}

function readString(row: DataRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function readNumber(row: DataRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function roundForDisplay(value: number) {
  return Math.round(value * 100) / 100;
}

export function inferTariffRate(row: DataRow, tariffs: DataRow[]) {
  const tariffId = readString(row, ["tariffId", "TariffId"]);
  const rowPrice = readNumber(row, ["price", "tariffPrice", "unitPrice", "rate"]);

  if (tariffId) {
    const match = tariffs.find((entry) => {
      const candidateId = readString(entry, ["tariffId", "id", "TariffId"]);
      return candidateId?.toLowerCase() === tariffId.toLowerCase();
    });

    if (match) {
      return {
        tariffId,
        tariffName: readString(match, ["tariffName", "name", "TariffName"]),
        pricePerUnit: readNumber(match, ["price", "tariffPrice", "unitPrice", "rate"]),
        source: "tariff",
      } satisfies TariffRateResolution;
    }
  }

  if (rowPrice !== null) {
    return {
      tariffId,
      tariffName: null,
      pricePerUnit: rowPrice,
      source: "row",
    } satisfies TariffRateResolution;
  }

  return {
    tariffId,
    tariffName: null,
    pricePerUnit: null,
    source: "unknown",
  } satisfies TariffRateResolution;
}

export function readCreditTokenContext(row: DataRow): CreditTokenContext {
  return {
    customerId: readString(row, ["customerId", "CustomerId"]),
    customerName: readString(row, ["customerName", "CustomerName"]),
    meterId: readString(row, ["meterId", "MeterId", "meterNo", "meterSn"]),
    meterType: readString(row, ["meterType", "type"]),
    tariffId: readString(row, ["tariffId", "TariffId"]),
    stationId: readString(row, ["stationId", "siteId", "StationId"]),
    totalDebt: readNumber(row, ["totalDebt", "debt", "remainingDebt"]),
    monthlyCharge: readNumber(row, ["monthlyCharge", "fixedCharge"]),
    sts: {
      sgc: readString(row, ["sgc"]),
      ti: readString(row, ["ti"]),
      ken: readString(row, ["ken"]),
      krn: readString(row, ["krn"]),
      kt: readString(row, ["kt"]),
      baseYear: readString(row, ["baseYear"]),
      sgcNew: readString(row, ["sgcNew"]),
      tiNew: readString(row, ["tiNew"]),
      kenNew: readString(row, ["kenNew"]),
      krnNew: readString(row, ["krnNew"]),
      ktNew: readString(row, ["ktNew"]),
      baseYearNew: readString(row, ["baseYearNew"]),
    },
  };
}

export function buildRechargeQuote(
  entryMode: RechargeEntryMode,
  entryValue: number,
  pricePerUnit: number | null,
) {
  if (!Number.isFinite(entryValue) || entryValue <= 0) {
    return null;
  }

  if (entryMode === "naira") {
    if (pricePerUnit === null || pricePerUnit <= 0) {
      return null;
    }

    const units = roundForDisplay(entryValue / pricePerUnit);
    return {
      entryMode,
      entryValue: roundForDisplay(entryValue),
      units,
      amountNaira: roundForDisplay(entryValue),
      pricePerUnit,
    } satisfies RechargeQuote;
  }

  return {
    entryMode,
    entryValue: roundForDisplay(entryValue),
    units: roundForDisplay(entryValue),
    amountNaira:
      pricePerUnit !== null && pricePerUnit > 0
        ? roundForDisplay(entryValue * pricePerUnit)
        : null,
    pricePerUnit,
  } satisfies RechargeQuote;
}

export function buildCreditTokenPayload(
  row: DataRow,
  input:
    | {
        entryMode: RechargeEntryMode;
        entryValue: number;
        quote: RechargeQuote | null;
      }
    | RechargeQuote
    | null,
  authorizationPassword: string,
  options: CreditTokenOptions = {
    isPreview: false,
    isVendByTotalPaid: true,
    payDebtPercent: null,
    isS2: false,
  },
  form: CreditTokenFormState = {
    paymentMethod: "cash",
    quotaEnabled: false,
    quotaValue: null,
    remark: "",
  },
) {
  const sanitizedPassword = authorizationPassword.trim();
  const context = readCreditTokenContext(row);
  const normalizedInput =
    input && "quote" in input
      ? input
      : {
          entryMode: "naira" as RechargeEntryMode,
          entryValue: input?.units ?? 0,
          quote: input,
        };
  const amount =
    normalizedInput.entryMode === "naira"
      ? normalizedInput.entryValue
      : normalizedInput.quote?.amountNaira ?? undefined;
  const unit =
    normalizedInput.entryMode === "unit"
      ? normalizedInput.entryValue
      : normalizedInput.quote?.units ?? undefined;
  const quotaValue = form.quotaEnabled ? form.quotaValue ?? undefined : undefined;
  const totalRecharge =
    options.isVendByTotalPaid
      ? amount
      : unit;

  return {
    row,
    customerId: context.customerId ?? undefined,
    customerName: context.customerName ?? undefined,
    meterId: context.meterId ?? undefined,
    meterType: context.meterType ?? undefined,
    tariffId: context.tariffId ?? undefined,
    stationId: context.stationId ?? undefined,
    amount,
    totalPaid: amount,
    totalPrice: amount,
    unit,
    totalUnit: unit,
    totalRecharge,
    totalDebt: context.totalDebt ?? undefined,
    monthlyCharge: context.monthlyCharge ?? undefined,
    isPreview: options.isPreview,
    isVendByTotalPaid: options.isVendByTotalPaid,
    payDebtPercent: options.payDebtPercent ?? undefined,
    isS2: options.isS2,
    paymentMethod: form.paymentMethod,
    quotaEnabled: form.quotaEnabled,
    quotaValue,
    remark: form.remark.trim() || undefined,
    ...context.sts,
    authorizationPassword: sanitizedPassword,
    AuthorizationPassword: sanitizedPassword,
    authPassword: sanitizedPassword,
    password2: sanitizedPassword,
  };
}
