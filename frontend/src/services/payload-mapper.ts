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

function parseDateValue(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = sanitizeString(value);
  if (trimmed.length === 0) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const dayFirstMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    const parsed = new Date(`${year}-${month}-${day}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function formatDateValue(
  value: string,
  format: DataPageConfig["requestDateFormat"] = "iso",
) {
  if (format !== "day-first") {
    return value;
  }

  const trimmed = sanitizeString(value);
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!isoMatch) {
    return trimmed;
  }

  const [, year, month, day] = isoMatch;
  return `${day}/${month}/${year}`;
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

  const from = parseDateValue(fromDate);
  const to = parseDateValue(toDate);

  if (!from || !to) {
    return null;
  }

  if (from.getTime() > to.getTime()) {
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
  const requiredKeys = new Set(page.requiredReadFilters ?? []);
  const filterByKey = new Map(page.filters.map((filter) => [filter.key, filter]));
  const knownFilterKeys = new Set(page.filters.map((filter) => filter.key));

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

    payload[filter.key] =
      filter.type === "date"
        ? formatDateValue(value, page.requestDateFormat)
        : value;
  }

  for (const requiredKey of requiredKeys) {
    const value = payload[requiredKey];
    const filter = filterByKey.get(requiredKey);

    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim().length === 0)
    ) {
      return {
        ok: false,
        message: `${filter?.label ?? requiredKey} is required`,
      };
    }
  }

  for (const [key, rawValue] of Object.entries(filters)) {
    if (knownFilterKeys.has(key)) {
      continue;
    }

    const value = sanitizeString(rawValue);
    if (value.length === 0) {
      continue;
    }

    payload[key] = value;
  }

  return { ok: true, payload };
}

function sanitizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const sanitized = sanitizeString(value);
  return sanitized.length > 0 ? sanitized : undefined;
}

function extractRemoteTarget(row?: DataRow) {
  const meterId = sanitizeOptionalString(row?.meterId);
  if (!meterId) {
    return null;
  }

  return {
    meterId,
    customerId: sanitizeOptionalString(row?.customerId),
    customerName: sanitizeOptionalString(row?.customerName),
    meterType: sanitizeOptionalString(row?.meterType),
    stationId: sanitizeOptionalString(row?.stationId),
    gatewayId: sanitizeOptionalString(row?.gatewayId),
    protocolVersion: sanitizeOptionalString(row?.protocolVersion),
  };
}

function sanitizeTaskName(values: Record<string, unknown>) {
  const taskNameRaw = values.taskName;
  const taskName = typeof taskNameRaw === "string" ? sanitizeString(taskNameRaw) : "";
  if (taskName.length > 0 && taskName.length < 2) {
    return { ok: false, message: "Task name must be at least 2 characters" } as const;
  }

  return { ok: true, taskName } as const;
}

function createRemoteBasePayload(row: DataRow | undefined, values: Record<string, unknown>) {
  const target = extractRemoteTarget(row);
  if (!target) {
    return { ok: false, message: "A target meter must be selected" } as const;
  }

  const taskNameResult = sanitizeTaskName(values);
  if (!taskNameResult.ok) {
    return taskNameResult;
  }

  return {
    ok: true,
    payload: {
      taskName: taskNameResult.taskName,
      name: taskNameResult.taskName,
      scheduleDate: sanitizeOptionalString(values.scheduleDate),
      dataPrefix: sanitizeOptionalString(values.dataPrefix),
      remark: sanitizeOptionalString(values.remark),
      target,
    },
  } as const;
}

function requireField(values: Record<string, unknown>, key: string, label: string) {
  const value = sanitizeOptionalString(values[key]);
  if (!value) {
    return { ok: false, message: `${label} is required` } as const;
  }

  return { ok: true, value } as const;
}

function requireOperatorReason(values: Record<string, unknown>) {
  const operatorReason = sanitizeOptionalString(values.operatorReason);
  if (!operatorReason || operatorReason.length < 5) {
    return { ok: false, message: "Operator Reason must be at least 5 characters" } as const;
  }

  return { ok: true, operatorReason } as const;
}

function buildReadingTaskPayload(row: DataRow | undefined, values: Record<string, unknown>): MappingResult {
  const base = createRemoteBasePayload(row, values);
  if (!base.ok) {
    return base;
  }

  const dataItem = requireField(values, "dataItem", "Data Item");
  if (!dataItem.ok) {
    return dataItem;
  }

  return {
    ok: true,
    payload: {
      taskType: "reading",
      ...base.payload,
      dataItem: dataItem.value,
      flag: sanitizeOptionalString(values.dataPrefix) ?? dataItem.value,
      readMode: sanitizeOptionalString(values.readMode),
    },
  };
}

function buildSettingTaskPayload(row: DataRow | undefined, values: Record<string, unknown>): MappingResult {
  const base = createRemoteBasePayload(row, values);
  if (!base.ok) {
    return base;
  }

  const settingKey = requireField(values, "settingKey", "Setting Key");
  if (!settingKey.ok) {
    return settingKey;
  }

  const settingValue = requireField(values, "settingValue", "Setting Value");
  if (!settingValue.ok) {
    return settingValue;
  }

  return {
    ok: true,
    payload: {
      taskType: "setting",
      ...base.payload,
      settingKey: settingKey.value,
      settingValue: settingValue.value,
      data: sanitizeOptionalString(values.data),
      valueType: sanitizeOptionalString(values.valueType) ?? "string",
    },
  };
}

function buildControlTaskPayload(row: DataRow | undefined, values: Record<string, unknown>): MappingResult {
  const base = createRemoteBasePayload(row, values);
  if (!base.ok) {
    return base;
  }

  const controlCommand = requireField(values, "controlCommand", "Control Command");
  if (!controlCommand.ok) {
    return controlCommand;
  }

  if (!["connect", "disconnect", "open", "close"].includes(controlCommand.value)) {
    return { ok: false, message: "Control Command is invalid" };
  }

  const reason = requireOperatorReason(values);
  if (!reason.ok) {
    return reason;
  }

  return {
    ok: true,
    payload: {
      taskType: "control",
      ...base.payload,
      controlCommand: controlCommand.value,
      reason: sanitizeOptionalString(values.reason),
      data: sanitizeOptionalString(values.data),
      operatorReason: reason.operatorReason,
      reviewConfirmed: values.reviewConfirmed === true || values.reviewConfirmed === "true",
    },
  };
}

function buildTokenTaskPayload(row: DataRow | undefined, values: Record<string, unknown>): MappingResult {
  const base = createRemoteBasePayload(row, values);
  if (!base.ok) {
    return base;
  }

  const tokenType = requireField(values, "tokenType", "Token Type");
  if (!tokenType.ok) {
    return tokenType;
  }

  const reason = requireOperatorReason(values);
  if (!reason.ok) {
    return reason;
  }

  return {
    ok: true,
    payload: {
      taskType: "token",
      ...base.payload,
      tokenType: tokenType.value,
      tokenValue: sanitizeOptionalString(values.tokenValue),
      data: sanitizeOptionalString(values.data),
      operatorReason: reason.operatorReason,
      reviewConfirmed: values.reviewConfirmed === true || values.reviewConfirmed === "true",
    },
  };
}

function buildTransparentForwardingPayload(row: DataRow | undefined, values: Record<string, unknown>): MappingResult {
  const base = createRemoteBasePayload(row, values);
  if (!base.ok) {
    return base;
  }

  const protocolMode = requireField(values, "protocolMode", "Protocol Mode");
  if (!protocolMode.ok) {
    return protocolMode;
  }

  if (!["hex", "ascii"].includes(protocolMode.value)) {
    return { ok: false, message: "Protocol Mode is invalid" };
  }

  const commandPayload = requireField(values, "commandPayload", "Command Payload");
  if (!commandPayload.ok) {
    return commandPayload;
  }

  const timeoutSeconds = toNumber(values.timeoutSeconds);
  if (timeoutSeconds !== null && (timeoutSeconds < 1 || timeoutSeconds > 300)) {
    return { ok: false, message: "Timeout (Seconds) must be between 1 and 300" };
  }

  const reason = requireOperatorReason(values);
  if (!reason.ok) {
    return reason;
  }

  return {
    ok: true,
    payload: {
      taskType: "transparent-forwarding",
      ...base.payload,
      protocolMode: protocolMode.value,
      commandPayload: commandPayload.value,
      timeoutSeconds: timeoutSeconds ?? undefined,
      operatorReason: reason.operatorReason,
      reviewConfirmed: values.reviewConfirmed === true || values.reviewConfirmed === "true",
    },
  };
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
    ...(page.omitReadPaging ? {} : { pageNumber, pageSize }),
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

  if (operationKind === "token-generate" || operationKind === "token-generate-credit") {
    const amount = toNumber(values.amount);
    const unit = toNumber(values.unit);
    const authorizationPassword = sanitizeOptionalString(values.authorizationPassword);

    if (amount === null || amount <= 0) {
      return { ok: false, message: "Amount must be greater than zero" };
    }

    if (unit === null || unit <= 0) {
      return { ok: false, message: "Unit must be greater than zero" };
    }

    if (!authorizationPassword) {
      return { ok: false, message: "Authorization Password is required" };
    }

    return {
      ok: true,
      payload: {
        row,
        amount,
        unit,
        authorizationPassword,
        AuthorizationPassword: authorizationPassword,
        authPassword: authorizationPassword,
        password2: authorizationPassword,
      },
    };
  }

  if (operationKind === "token-generate-limit") {
    const limitValue = toNumber(values.limitValue);
    const authorizationPassword = sanitizeOptionalString(values.authorizationPassword);
    if (limitValue === null || limitValue <= 0) {
      return { ok: false, message: "Limit Value must be greater than zero" };
    }

    if (!authorizationPassword) {
      return { ok: false, message: "Authorization Password is required" };
    }

    return {
      ok: true,
      payload: {
        row,
        limitValue,
        authorizationPassword,
        AuthorizationPassword: authorizationPassword,
        authPassword: authorizationPassword,
        password2: authorizationPassword,
      },
    };
  }

  if (operationKind === "token-generate-basic") {
    const authorizationPassword = sanitizeOptionalString(values.authorizationPassword);
    if (!authorizationPassword) {
      return { ok: false, message: "Authorization Password is required" };
    }

    return {
      ok: true,
      payload: {
        row,
        authorizationPassword,
        AuthorizationPassword: authorizationPassword,
        authPassword: authorizationPassword,
        password2: authorizationPassword,
      },
    };
  }

  if (operationKind === "task-create") {
    if (action.payloadBuilderKey === "reading") {
      return buildReadingTaskPayload(context.row, values);
    }

    if (action.payloadBuilderKey === "setting") {
      return buildSettingTaskPayload(context.row, values);
    }

    if (action.payloadBuilderKey === "control") {
      return buildControlTaskPayload(context.row, values);
    }

    if (action.payloadBuilderKey === "token") {
      return buildTokenTaskPayload(context.row, values);
    }

    if (action.payloadBuilderKey === "transparent-forwarding") {
      return buildTransparentForwardingPayload(context.row, values);
    }

    const taskNameResult = sanitizeTaskName(values);
    if (!taskNameResult.ok) {
      return taskNameResult;
    }

    return {
      ok: true,
      payload: {
        row,
        ...filterFilledValues(values),
        taskName: taskNameResult.taskName,
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

  if (operationKind === "drilldown") {
    if (!row) {
      return { ok: false, message: `${action.label} requires a selected row` };
    }

    return { ok: true, payload: { row } };
  }

  if (operationKind === "theft-case-create") {
    if (!row) {
      return { ok: false, message: `${action.label} requires a selected row` };
    }

    return {
      ok: true,
      payload: {
        row,
        meterId: row.meterId,
        customerName: row.customerName,
        notes: sanitizeOptionalString(values.notes),
      },
    };
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
