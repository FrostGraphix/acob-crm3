import type {
  ActionConfig,
  ActionOperationKind,
  DataPageConfig,
  DataRow,
  ReadOperationKind,
} from "../types";

interface MappingResult {
  ok: boolean;
  payload?: Record<string, unknown>;
  message?: string;
}

function parseDelimitedLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  return cells;
}

function sanitizeString(value: string) {
  let output = "";

  for (const character of value) {
    const code = character.charCodeAt(0);
    const isControl = (code >= 0 && code <= 8) || (code >= 11 && code <= 31) || code === 127;
    if (!isControl) {
      output += character;
    }
  }

  return output.trim();
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 300).map((entry) => sanitizeValue(entry));
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
      (accumulator, [key, entry]) => {
        accumulator[key] = sanitizeValue(entry);
        return accumulator;
      },
      {},
    );
  }

  return value;
}

function sanitizeRecord(record: Record<string, unknown>) {
  return sanitizeValue(record) as Record<string, unknown>;
}

function filterFilledValues(
  record: Record<string, unknown>,
  options: { keepEmptyStrings?: boolean } = {},
) {
  return Object.entries(record).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
    if (value === null || value === undefined) {
      return accumulator;
    }

    if (typeof value === "string" && value.length === 0 && !options.keepEmptyStrings) {
      return accumulator;
    }

    accumulator[key] = value;
    return accumulator;
  }, {});
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function compactRow(row: DataRow | undefined) {
  if (!row) {
    return undefined;
  }

  return Object.entries(row).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
    if (value !== null && value !== "") {
      accumulator[key] = value;
    }
    return accumulator;
  }, {});
}

function parseImportRecords(input: string) {
  const trimmed = sanitizeString(input);

  if (trimmed.length === 0) {
    return [];
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as unknown;
    const records = Array.isArray(parsed) ? parsed : [parsed];

    return records
      .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
      .map((entry) => filterFilledValues(sanitizeRecord(entry)));
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseDelimitedLine(lines[0]).map((header) => sanitizeString(header));

  return lines.slice(1).map((line) => {
    const values = parseDelimitedLine(line);
    const record = headers.reduce<Record<string, unknown>>((accumulator, header, index) => {
      if (!header) {
        return accumulator;
      }

      accumulator[header] = values[index] ?? "";
      return accumulator;
    }, {});

    return filterFilledValues(sanitizeRecord(record));
  });
}

function ensureValidDateRange(
  fromDate: unknown,
  toDate: unknown,
): MappingResult | null {
  if (typeof fromDate !== "string" || typeof toDate !== "string") {
    return null;
  }

  if (!fromDate || !toDate) {
    return null;
  }

  if (fromDate > toDate) {
    return {
      ok: false,
      message: "From date cannot be after to date",
    };
  }

  return null;
}

function normalizeReadFilters(
  page: DataPageConfig,
  filters: Record<string, string>,
): MappingResult {
  const payload: Record<string, unknown> = {};

  for (const filter of page.filters) {
    const rawValue = filters[filter.key];
    if (rawValue === undefined) {
      continue;
    }

    const value = sanitizeString(rawValue);
    if (value.length === 0) {
      continue;
    }

    if (filter.type === "number") {
      const parsed = toNumber(value);
      if (parsed === null) {
        return {
          ok: false,
          message: `${filter.label} must be a valid number`,
        };
      }

      payload[filter.key] = parsed;
      continue;
    }

    payload[filter.key] = value;
  }

  return { ok: true, payload };
}

function mapReadOperationKind(
  operationKind: ReadOperationKind,
  payload: Record<string, unknown>,
): MappingResult {
  if (operationKind === "report-read") {
    const dateError = ensureValidDateRange(payload.fromDate, payload.toDate);
    if (dateError) {
      return dateError;
    }
  }

  if (payload.pageNumber !== undefined) {
    const pageNumber = toNumber(payload.pageNumber);
    if (pageNumber === null || pageNumber < 1) {
      return { ok: false, message: "Invalid page number" };
    }
    payload.pageNumber = Math.floor(pageNumber);
  }

  if (payload.pageSize !== undefined) {
    const pageSize = toNumber(payload.pageSize);
    if (pageSize === null || pageSize < 1 || pageSize > 500) {
      return { ok: false, message: "Invalid page size" };
    }
    payload.pageSize = Math.floor(pageSize);
  }

  return { ok: true, payload };
}

export function buildReadPayload(
  page: DataPageConfig,
  filters: Record<string, string>,
  pageNumber: number,
  pageSize: number,
): MappingResult {
  const normalizedFilters = normalizeReadFilters(page, filters);
  if (!normalizedFilters.ok) {
    return normalizedFilters;
  }

  const payload = sanitizeRecord({
    ...(normalizedFilters.payload ?? {}),
    pageNumber,
    pageSize,
  });

  return mapReadOperationKind(page.readOperationKind ?? "table-read", payload);
}

function mapActionByKind(
  operationKind: ActionOperationKind,
  action: ActionConfig,
  context: {
    row?: DataRow;
    values?: Record<string, string>;
    selectedKeys?: string[];
  },
): MappingResult {
  const values = sanitizeRecord(context.values ?? {});
  const row = compactRow(context.row);
  const selectedKeys = (context.selectedKeys ?? []).map((entry) => sanitizeString(entry));

  if (operationKind === "token-generate") {
    const amount = toNumber(values.amount);
    const unit = toNumber(values.unit);

    if (amount === null || amount <= 0) {
      return { ok: false, message: "Amount must be greater than zero" };
    }

    if (unit === null || unit <= 0) {
      return { ok: false, message: "Unit must be greater than zero" };
    }

    return {
      ok: true,
      payload: {
        row,
        amount,
        unit,
      },
    };
  }

  if (operationKind === "task-create") {
    const taskNameRaw = values.taskName;
    const taskName = typeof taskNameRaw === "string" ? sanitizeString(taskNameRaw) : "";
    if (taskName.length > 0 && taskName.length < 2) {
      return { ok: false, message: "Task name must be at least 2 characters" };
    }

    return {
      ok: true,
      payload: {
        row,
        taskName,
        scheduleDate: values.scheduleDate,
      },
    };
  }

  if (operationKind === "task-update") {
    const remarkRaw = values.remark;
    const remark = typeof remarkRaw === "string" ? sanitizeString(remarkRaw) : "";
    if (!row) {
      return { ok: false, message: `${action.label} requires a selected row` };
    }
    if (remark.length > 0 && remark.length < 2) {
      return { ok: false, message: "Remark must be at least 2 characters" };
    }

    return {
      ok: true,
      payload: {
        row,
        remark,
      },
    };
  }

  if (operationKind === "management-create" || operationKind === "management-update") {
    const payload = filterFilledValues(values, {
      keepEmptyStrings: operationKind === "management-update",
    });

    if (Object.keys(payload).length === 0) {
      return { ok: false, message: "At least one field is required" };
    }

    if (operationKind === "management-update") {
      if (!row) {
        return { ok: false, message: `${action.label} requires a selected row` };
      }
      payload.row = row;
    }

    return { ok: true, payload };
  }

  if (operationKind === "management-import") {
    const importDataRaw = values.importData;
    const importData = typeof importDataRaw === "string" ? importDataRaw : "";

    try {
      const records = parseImportRecords(importData).filter((record) => Object.keys(record).length > 0);

      if (records.length === 0) {
        return {
          ok: false,
          message: "Import data must contain at least one valid CSV row or JSON object",
        };
      }

      return {
        ok: true,
        payload: {
          records,
        },
      };
    } catch {
      return {
        ok: false,
        message: "Import data must be valid CSV or JSON",
      };
    }
  }

  if (operationKind === "management-delete" || operationKind === "record-cancel") {
    if (!row) {
      return { ok: false, message: `${action.label} requires a selected row` };
    }

    return { ok: true, payload: { row } };
  }

  if (operationKind === "bulk-delete") {
    if (selectedKeys.length === 0) {
      return { ok: false, message: "Select at least one row for bulk delete" };
    }
    return { ok: true, payload: { selectedKeys } };
  }

  if (operationKind === "report-export") {
    return { ok: true, payload: values };
  }

  return {
    ok: true,
    payload: {
      ...values,
      row,
      selectedKeys,
    },
  };
}

export function buildActionPayload(
  action: ActionConfig,
  context: {
    row?: DataRow;
    values?: Record<string, string>;
    selectedKeys?: string[];
  },
): MappingResult {
  return mapActionByKind(action.operationKind ?? "generic", action, context);
}
