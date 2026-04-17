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
  quote: RechargeQuote,
  authorizationPassword: string,
) {
  const sanitizedPassword = authorizationPassword.trim();

  return {
    row,
    // Upstream uses `amount` as the unit quantity to vend.
    amount: quote.units,
    unit: quote.units,
    authorizationPassword: sanitizedPassword,
    AuthorizationPassword: sanitizedPassword,
    authPassword: sanitizedPassword,
    password2: sanitizedPassword,
  };
}
