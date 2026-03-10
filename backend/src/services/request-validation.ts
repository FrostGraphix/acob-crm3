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

export function sanitizeRequestBody(body: unknown) {
  return toRecord(body);
}

export function mapRequestBodyByOperation(
  operation: OperationKind,
  body: Record<string, unknown>,
) {
  const mapped = { ...body };

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

    if (amount !== null) {
      mapped.amount = amount;
    }

    if (unit !== null) {
      mapped.unit = unit;
    }
  }

  return { body: mapped, validation: { valid: true } as ValidationResult };
}

export function validateRequestBodyByOperation(
  operation: OperationKind,
  body: Record<string, unknown>,
): ValidationResult {
  if (operation === "token-generate") {
    const amount = coerceNumber(body.amount);
    const unit = coerceNumber(body.unit);

    if (amount === null || amount <= 0) {
      return { valid: false, message: "amount must be greater than zero" };
    }

    if (unit === null || unit <= 0) {
      return { valid: false, message: "unit must be greater than zero" };
    }
  }

  if (operation === "task-update") {
    const row = toRecord(body.row);
    if (!hasRowIdentifier(row)) {
      return { valid: false, message: "task update requires a target row identifier" };
    }
  }

  if (operation === "crud-update") {
    const row = toRecord(body.row);
    if (!hasRowIdentifier(row) && !isPlainObject(body)) {
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
