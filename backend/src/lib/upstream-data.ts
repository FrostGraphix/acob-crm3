/**
 * Shared helpers for parsing upstream API response envelopes.
 * Consolidates logic previously duplicated in analysis-engine.ts
 * and site-consumption-engine.ts.
 */

export type ReportRow = Record<string, unknown>;

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asRecordArray(value: unknown): ReportRow[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is ReportRow =>
          typeof entry === "object" && entry !== null && !Array.isArray(entry),
      )
    : [];
}

export function firstAvailableRows(candidates: unknown[]) {
  let fallback: ReportRow[] = [];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const rows = asRecordArray(candidate);
      if (rows.length > 0) {
        return rows;
      }

      fallback = rows;
    }
  }

  return fallback;
}

export function extractRows(result: unknown): ReportRow[] {
  if (Array.isArray(result)) {
    return asRecordArray(result);
  }

  const root = asRecord(result);
  const page = asRecord(root.page);

  return firstAvailableRows([
    root.rows,
    root.list,
    root.data,
    root.records,
    page.rows,
    page.list,
    page.data,
    page.records,
  ]);
}

export function readString(record: ReportRow, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

export function readNumber(record: ReportRow, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
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

  return undefined;
}
