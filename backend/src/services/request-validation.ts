import type { OperationKind } from "./endpoint-registry.js";

interface ValidationResult {
  valid: boolean;
  message?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeString(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

function sanitizeUnknown(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 300).map((entry) => sanitizeUnknown(entry));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce<Record<string, unknown>>((accumulator, [key, entry]) => {
      accumulator[key] = sanitizeUnknown(entry);
      return accumulator;
    }, {});
  }

  return value;
}

function toRecord(value: unknown) {
  return isPlainObject(value)
    ? (sanitizeUnknown(value) as Record<string, unknown>)
    : {};
}

function getSanitizedString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? sanitizeString(value) : "";
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const trimmed = sanitizeString(value);
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const parsed = new Date(`${trimmed}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const dayFirstMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!dayFirstMatch) {
    return null;
  }

  const [, day, month, year] = dayFirstMatch;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validateDateRange(
  body: Record<string, unknown>,
  options: { required?: boolean; maxDays?: number } = {},
): ValidationResult {
  const fromDate = parseDate(body.fromDate);
  const toDate = parseDate(body.toDate);
  const required = options.required ?? false;

  if (required && (!fromDate || !toDate)) {
    return { valid: false, message: "fromDate and toDate are required" };
  }

  if ((body.fromDate !== undefined && !fromDate) || (body.toDate !== undefined && !toDate)) {
    return { valid: false, message: "fromDate/toDate must be valid dates" };
  }

  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    return { valid: false, message: "fromDate cannot be after toDate" };
  }

  if (fromDate && toDate && options.maxDays) {
    const diffDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays > options.maxDays) {
      return { valid: false, message: `Date range exceeds maximum window of ${options.maxDays} days` };
    }
  }

  return { valid: true };
}

function hasRowIdentifier(row: Record<string, unknown>) {
  return Boolean(
    row.id ??
      row.customerId ??
      row.meterId ??
      row.receiptId ??
      row.gatewayId ??
      row.name,
  );
}

function validatePaging(body: Record<string, unknown>): ValidationResult {
  if (body.pageNumber !== undefined) {
    const pageNumber = coerceNumber(body.pageNumber);
    if (pageNumber === null || pageNumber < 1 || !Number.isInteger(pageNumber)) {
      return { valid: false, message: "pageNumber must be a positive integer" };
    }
    body.pageNumber = pageNumber;
  }

  if (body.pageSize !== undefined) {
    const pageSize = coerceNumber(body.pageSize);
    if (pageSize === null || pageSize < 1 || pageSize > 500 || !Number.isInteger(pageSize)) {
      return { valid: false, message: "pageSize must be an integer between 1 and 500" };
    }
    body.pageSize = pageSize;
  }

  return { valid: true };
}

function stripEmptyReadValues(body: Record<string, unknown>) {
  return Object.entries(body).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
    if (typeof value === "string" && value.length === 0) {
      return accumulator;
    }

    accumulator[key] = value;
    return accumulator;
  }, {});
}

export function sanitizeRequestBody(body: unknown) {
  return toRecord(body);
}

export function mapRequestBodyByOperation(
  operation: OperationKind,
  body: Record<string, unknown>,
) {
  const mapped =
    operation === "read" || operation === "task-read" || operation === "drilldown"
      ? stripEmptyReadValues(body)
      : { ...body };

  if (
    operation === "read" ||
    operation === "task-read" ||
    operation === "drilldown"
  ) {
    const paging = validatePaging(mapped);
    if (!paging.valid) {
      return { body: mapped, validation: paging };
    }
  }

  if (operation === "token-generate") {
    const amount = coerceNumber(mapped.amount);
    const unit = coerceNumber(mapped.unit);
    const limitValue = coerceNumber(mapped.limitValue);

    if (amount !== null) {
      mapped.amount = amount;
    }

    if (unit !== null) {
      mapped.unit = unit;
    }

    if (limitValue !== null) {
      mapped.limitValue = limitValue;
    }
  }

  return { body: mapped, validation: { valid: true } as ValidationResult };
}

export function validateRequestBodyByOperation(
  operation: OperationKind,
  body: Record<string, unknown>,
): ValidationResult {
  if (operation === "task-update") {
    const row = toRecord(body.row);
    if (!hasRowIdentifier(row)) {
      return { valid: false, message: "task update requires a target row identifier" };
    }
  }

  if (operation === "crud-update") {
    const row = toRecord(body.row);
    if (!hasRowIdentifier(row) && !hasRowIdentifier(body)) {
      return { valid: false, message: "update action requires a target row" };
    }
  }

  if (operation === "crud-delete" || operation === "token-cancel") {
    const row = toRecord(body.row);
    const selectedKeys = Array.isArray(body.selectedKeys) ? body.selectedKeys : [];
    if (!hasRowIdentifier(row) && selectedKeys.length === 0) {
      return { valid: false, message: "delete action requires row or selectedKeys" };
    }
  }

  if (operation === "task-create") {
    const taskName = typeof body.taskName === "string" ? sanitizeString(body.taskName) : "";
    if (taskName.length > 0 && taskName.length < 2) {
      return { valid: false, message: "taskName must be at least 2 characters when provided" };
    }
  }

  const paging = validatePaging(body);
  if (!paging.valid) {
    return paging;
  }

  return { valid: true };
}

function validateRemoteTarget(target: Record<string, unknown>): ValidationResult {
  if (!getSanitizedString(target, "meterId")) {
    return { valid: false, message: "target.meterId is required" };
  }

  return { valid: true };
}

export function validateRequestBodyByPathname(
  pathname: string,
  body: Record<string, unknown>,
): ValidationResult {
  if (pathname.startsWith("/API/RemoteMeterTask/")) {
    if (pathname.includes("/Update")) {
      const row = toRecord(body.row);
      if (!hasRowIdentifier(row)) {
        return { valid: false, message: "task update requires a target row identifier" };
      }
    }

    if (!pathname.includes("/Create")) {
      return { valid: true };
    }

    const target = toRecord(body.target);
    const targetValidation = validateRemoteTarget(target);
    if (!targetValidation.valid) {
      return targetValidation;
    }

    if (pathname === "/API/RemoteMeterTask/CreateReadingTask") {
      if (!getSanitizedString(body, "dataItem")) {
        return { valid: false, message: "dataItem is required" };
      }
    }

    if (pathname === "/API/RemoteMeterTask/CreateSettingTask") {
      if (!getSanitizedString(body, "settingKey")) {
        return { valid: false, message: "settingKey is required" };
      }

      if (!getSanitizedString(body, "settingValue")) {
        return { valid: false, message: "settingValue is required" };
      }
    }

    if (pathname === "/API/RemoteMeterTask/CreateControlTask") {
      const controlCommand = getSanitizedString(body, "controlCommand");
      if (!["connect", "disconnect", "open", "close"].includes(controlCommand)) {
        return { valid: false, message: "controlCommand is invalid" };
      }
    }

    if (
      pathname === "/API/RemoteMeterTask/CreateControlTask" ||
      pathname === "/API/RemoteMeterTask/CreateTokenTask" ||
      pathname === "/API/RemoteMeterTask/CreateTransparentForwardingTask"
    ) {
      if (body.reviewConfirmed !== true) {
        return { valid: false, message: "reviewConfirmed must be true for high-risk tasks" };
      }

      const operatorReason = getSanitizedString(body, "operatorReason");
      if (operatorReason.length < 5) {
        return { valid: false, message: "operatorReason must be at least 5 characters" };
      }
    }

    if (pathname === "/API/RemoteMeterTask/CreateTokenTask") {
      if (!getSanitizedString(body, "tokenType")) {
        return { valid: false, message: "tokenType is required" };
      }
    }

    if (pathname === "/API/RemoteMeterTask/CreateTransparentForwardingTask") {
      const protocolMode = getSanitizedString(body, "protocolMode");
      if (!["hex", "ascii"].includes(protocolMode)) {
        return { valid: false, message: "protocolMode is invalid" };
      }

      if (!getSanitizedString(body, "commandPayload")) {
        return { valid: false, message: "commandPayload is required" };
      }

      const timeoutSeconds = coerceNumber(body.timeoutSeconds);
      if (timeoutSeconds !== null && (timeoutSeconds < 1 || timeoutSeconds > 300)) {
        return { valid: false, message: "timeoutSeconds must be between 1 and 300" };
      }
    }

    return { valid: true };
  }

  if (pathname.startsWith("/API/GPRSMeterTask/") || pathname.startsWith("/api/GPRSMeterTask/")) {
    if (pathname.includes("/Update")) {
      const row = toRecord(body.row);
      if (!hasRowIdentifier(row) && !hasRowIdentifier(body)) {
        return { valid: false, message: "task update requires a target row identifier" };
      }

      return { valid: true };
    }

    if (pathname.includes("/Create")) {
      const target = toRecord(body.target);
      if (Object.keys(target).length > 0) {
        const targetValidation = validateRemoteTarget(target);
        if (!targetValidation.valid) {
          return targetValidation;
        }
      }
    }

    return { valid: true };
  }

  if (pathname.startsWith("/API/PrepayReport/")) {
    const dateRange = validateDateRange(body, {
      required:
        pathname === "/API/PrepayReport/LowPurchaseSituation" ||
        pathname === "/API/PrepayReport/ConsumptionStatistics",
      maxDays: 400,
    });
    if (!dateRange.valid) {
      return dateRange;
    }

    if (pathname === "/API/PrepayReport/LongNonpurchaseSituation") {
      const start = coerceNumber(body.nonpurchaseDaysStart);
      const end = coerceNumber(body.nonpurchaseDaysEnd);
      if (start !== null && start < 0) {
        return { valid: false, message: "nonpurchaseDaysStart cannot be negative" };
      }
      if (end !== null && end < 0) {
        return { valid: false, message: "nonpurchaseDaysEnd cannot be negative" };
      }
      if (start !== null && end !== null && start > end) {
        return { valid: false, message: "nonpurchaseDaysStart cannot be greater than nonpurchaseDaysEnd" };
      }
    }

    if (pathname === "/API/PrepayReport/LowPurchaseSituation") {
      const lowLimit = coerceNumber(body.lowLimit);
      if (lowLimit !== null && lowLimit < 0) {
        return { valid: false, message: "lowLimit cannot be negative" };
      }
    }

    return { valid: true };
  }

  if (
    pathname === "/API/LoadProfile/DailyData" ||
    pathname === "/API/LoadProfile/MonthlyData" ||
    pathname === "/API/LoadProfile/ElectricEnergyCurve" ||
    pathname === "/API/LoadProfile/InstantaneousValueCurve"
  ) {
    const dateRange = validateDateRange(body, { required: false, maxDays: 366 });
    if (!dateRange.valid) {
      return dateRange;
    }

    return { valid: true };
  }

  if (pathname.startsWith("/api/token/")) {
    if (pathname === "/api/token/creditToken/generate") {
      const amount = coerceNumber(body.amount);
      const unit = coerceNumber(body.unit);
      if (amount === null || amount <= 0) {
        return { valid: false, message: "amount must be greater than zero" };
      }
      if (unit === null || unit <= 0) {
        return { valid: false, message: "unit must be greater than zero" };
      }
      return { valid: true };
    }

    if (
      pathname === "/api/token/setMaximumPowerLimitToken/generate" ||
      pathname === "/api/token/setMaximumPhasePowerUnbalanceLimitToken/generate" ||
      pathname === "/api/token/setMaximumOverdraftLimitToken/generate"
    ) {
      const limitValue = coerceNumber(body.limitValue);
      if (limitValue === null || limitValue <= 0) {
        return { valid: false, message: "limitValue must be greater than zero" };
      }
      return { valid: true };
    }

    return { valid: true };
  }

  if (
    pathname === "/api/DailyDataMeter/readHourly" ||
    pathname === "/api/DailyDataMeter/readMonthly" ||
    pathname === "/api/DailyDataMeter/readMore"
  ) {
    const row = toRecord(body.row);
    if (!hasRowIdentifier(row)) {
      return { valid: false, message: "drilldown action requires a target row" };
    }
  }

  return { valid: true };
}

