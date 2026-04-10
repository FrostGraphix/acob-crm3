import type {
  ActionConfig,
  ActionField,
  DataPageConfig,
  FilterField,
  TableColumn,
} from "../types/index.ts";

export const searchFilter: FilterField = {
  key: "searchTerm",
  label: "Search",
  placeholder: "Search by keyword",
  type: "text",
};

export const dateRangeFilters: FilterField[] = [
  {
    key: "fromDate",
    label: "Start Date",
    placeholder: "Start date",
    type: "date",
  },
  {
    key: "toDate",
    label: "End Date",
    placeholder: "End date",
    type: "date",
  },
];

export const creditTokenRecordFilters: FilterField[] = [
  ...dateRangeFilters,
  searchFilter,
  {
    key: "receiptId",
    label: "Receipt Id",
    placeholder: "Search receipt id",
    type: "text",
  },
  {
    key: "customerId",
    label: "Customer Id",
    placeholder: "Search customer id",
    type: "text",
  },
  {
    key: "customerName",
    label: "Customer Name",
    placeholder: "Search customer name",
    type: "text",
  },
  {
    key: "meterId",
    label: "Meter Id",
    placeholder: "Search meter id",
    type: "text",
  },
  {
    key: "meterType",
    label: "Meter Type",
    placeholder: "Search meter type",
    type: "text",
  },
  {
    key: "tariffId",
    label: "Tariff Id",
    placeholder: "Search tariff id",
    type: "text",
  },
  {
    key: "vatCharge",
    label: "VAT Charge",
    placeholder: "Search VAT charge",
    type: "number",
  },
  {
    key: "totalUnit",
    label: "Total Unit",
    placeholder: "Search total unit",
    type: "number",
  },
  {
    key: "totalPrice",
    label: "Total Paid",
    placeholder: "Search total paid",
    type: "number",
  },
  {
    key: "tokenRecharge",
    label: "Recharge(kwh)",
    placeholder: "Search recharge",
    type: "number",
  },
  {
    key: "createId",
    label: "Vend",
    placeholder: "Search vend",
    type: "text",
  },
  {
    key: "token",
    label: "Token",
    placeholder: "Search token",
    type: "text",
  },
  {
    key: "createTime",
    label: "Time",
    placeholder: "Search time",
    type: "text",
  },
  {
    key: "remark",
    label: "Remark",
    placeholder: "Search remark",
    type: "text",
  },
  {
    key: "stationId",
    label: "Station Id",
    placeholder: "Search station id",
    type: "text",
  },
];

export const accountColumns: TableColumn[] = [
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "meterType", label: "Meter Type" },
  { key: "communicationWay", label: "Communication Way" },
  { key: "tariffId", label: "Tariff Id" },
  { key: "protocolVersion", label: "Protocol Version" },
  { key: "remark", label: "Remark" },
  { key: "createTime", label: "Create Time" },
  { key: "stationId", label: "Station Id" },
];

export const tokenGenerateColumns: TableColumn[] = [
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "meterType", label: "Meter Type" },
  { key: "tariffId", label: "Tariff Id" },
  { key: "protocolVersion", label: "Protocol Version" },
  { key: "createTime", label: "Create Time" },
];

export const creditTokenRecordColumns: TableColumn[] = [
  { key: "receiptId", label: "Receipt Id", searchable: true },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "meterType", label: "Meter Type", searchable: true },
  { key: "tariffId", label: "Tariff Id", searchable: true },
  { key: "vatCharge", label: "VAT Charge", align: "end", searchable: true },
  { key: "totalUnit", label: "Total Unit", align: "end", searchable: true },
  { key: "totalPrice", label: "Total Paid", align: "end", searchable: true },
  { key: "tokenRecharge", label: "Recharge(kwh)", align: "end", searchable: true },
  { key: "createId", label: "Vend", searchable: true },
  { key: "token", label: "Token", searchable: true },
  { key: "createTime", label: "Time", searchable: true },
  { key: "remark", label: "Remark", searchable: true },
  { key: "stationId", label: "Station Id", searchable: true },
];

export const clearTokenRecordColumns: TableColumn[] = [
  { key: "receiptId", label: "Receipt Id", searchable: true },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "tokenRecharge", label: "Token", align: "end" },
  { key: "createTime", label: "Create Time" },
  { key: "stationId", label: "Station Id" },
];

export const maximumPowerRecordColumns: TableColumn[] = [
  { key: "receiptId", label: "Receipt Id", searchable: true },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "maximumPowerLimit", label: "Maximum Power Limit", align: "end" },
];

export const remoteColumns: TableColumn[] = [
  { key: "status", label: "Status" },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "meterType", label: "Meter Type" },
  { key: "remark", label: "Remark" },
  { key: "stationId", label: "Station Id" },
];

export const genericTaskColumns: TableColumn[] = [
  { key: "status", label: "Status" },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "createTime", label: "Create Time" },
  { key: "remark", label: "Remark" },
  { key: "stationId", label: "Station Id" },
];

export const meterReadingTaskColumns: TableColumn[] = [
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "dataItem", label: "Data Item" },
  { key: "stationId", label: "Station Id" },
  { key: "dataValue", label: "Data Value", align: "end" },
  { key: "status", label: "Status" },
  { key: "createTime", label: "Create Time" },
  { key: "updateTime", label: "Update Time" },
];

export const meterControlTaskColumns: TableColumn[] = [
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "dataItem", label: "Data Item" },
  { key: "site", label: "Site" },
];

export const meterTokenTaskColumns: TableColumn[] = [
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "dataItem", label: "Data Item" },
  { key: "token", label: "Token" },
];

export const intervalColumns: TableColumn[] = [
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "gatewayId", label: "Gateway Id" },
  { key: "collectionDate", label: "Collection Date" },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "sectionId", label: "Section Id" },
  { key: "totalEnergy", label: "Total Energy", align: "end" },
  { key: "lastHourUsage", label: "Last Hour Usage", align: "end" },
  { key: "creditBalance", label: "Credit Balance", align: "end" },
  { key: "maximumDemand", label: "Maximum Demand", align: "end" },
  { key: "power", label: "Power", align: "end" },
  { key: "relayStatus", label: "Relay Status" },
  { key: "energyStatus", label: "Energy Status" },
  { key: "magneticStatus", label: "Magnetic Status" },
  { key: "terminalCover", label: "Terminal Cover" },
  { key: "upperOpen", label: "Upper Open" },
  { key: "currentReverse", label: "Current Reverse" },
  { key: "currentUnbalance", label: "Current Unbalance" },
  { key: "updateTime", label: "Update Time" },
];

export const customerColumns: TableColumn[] = [
  { key: "id", label: "Id", searchable: true },
  { key: "name", label: "Name", searchable: true },
  { key: "phone", label: "Phone", searchable: true },
  { key: "address", label: "Address", searchable: true },
  { key: "certifiName", label: "Certifi Name" },
  { key: "certifiNo", label: "Certifi No" },
  { key: "remark", label: "Remark" },
  { key: "createTime", label: "Create Time" },
  { key: "updateTime", label: "Update Time" },
  { key: "stationId", label: "Station Id" },
];

export const tariffColumns: TableColumn[] = [
  { key: "id", label: "Id", searchable: true },
  { key: "name", label: "Name", searchable: true },
  { key: "price", label: "Price", align: "end" },
  { key: "remark", label: "Remark" },
  { key: "createTime", label: "Create Time" },
  { key: "updateTime", label: "Update Time" },
];

export const gatewayColumns: TableColumn[] = [
  { key: "status", label: "Status" },
  { key: "successRate", label: "Success Rate", align: "end" },
  { key: "id", label: "Id", searchable: true },
  { key: "name", label: "Name", searchable: true },
];

export const meterColumns: TableColumn[] = [
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "meterType", label: "Meter Type" },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "communicationWay", label: "Communication Way" },
  { key: "protocolVersion", label: "Protocol Version" },
  { key: "gatewayId", label: "Gateway Id" },
  { key: "stationId", label: "Station Id" },
  { key: "status", label: "Status" },
  { key: "createTime", label: "Create Time" },
];

export const debtColumns: TableColumn[] = [
  { key: "id", label: "Id", searchable: true },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "amount", label: "Amount", align: "end" },
  { key: "status", label: "Status" },
  { key: "remark", label: "Remark" },
  { key: "createTime", label: "Create Time" },
  { key: "updateTime", label: "Update Time" },
];

export const dlmsColumns: TableColumn[] = [
  { key: "id", label: "Id", searchable: true },
  { key: "name", label: "Name", searchable: true },
  { key: "obisCode", label: "OBIS Code" },
  { key: "classId", label: "Class Id" },
  { key: "attributeIndex", label: "Attribute Index" },
  { key: "dataType", label: "Data Type" },
  { key: "remark", label: "Remark" },
];

export const dlt645Columns: TableColumn[] = [
  { key: "id", label: "Id", searchable: true },
  { key: "name", label: "Name", searchable: true },
  { key: "dataIdentifier", label: "Data Identifier" },
  { key: "dataLength", label: "Data Length" },
  { key: "dataType", label: "Data Type" },
  { key: "remark", label: "Remark" },
];

export const itemColumns: TableColumn[] = [
  { key: "id", label: "Id", searchable: true },
  { key: "name", label: "Name", searchable: true },
  { key: "unit", label: "Unit" },
  { key: "dataType", label: "Data Type" },
  { key: "remark", label: "Remark" },
  { key: "createTime", label: "Create Time" },
];

export const loadProfileColumns: TableColumn[] = [
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "collectionDate", label: "Collection Date" },
  { key: "value", label: "Value", align: "end" },
  { key: "unit", label: "Unit" },
  { key: "status", label: "Status" },
];

export const eventNotificationColumns: TableColumn[] = [
  { key: "id", label: "Id", searchable: true },
  { key: "eventType", label: "Event Type" },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "description", label: "Description" },
  { key: "severity", label: "Severity" },
  { key: "createTime", label: "Create Time" },
  { key: "status", label: "Status" },
];

export const logColumns: TableColumn[] = [
  { key: "id", label: "Id" },
  { key: "action", label: "Action" },
  { key: "username", label: "Username", searchable: true },
  { key: "ipAddress", label: "IP Address" },
  { key: "module", label: "Module" },
  { key: "detail", label: "Detail" },
  { key: "createTime", label: "Create Time" },
];

export const dlt645TaskColumns: TableColumn[] = [
  { key: "status", label: "Status" },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "dataIdentifier", label: "Data Identifier" },
  { key: "dataValue", label: "Data Value", align: "end" },
  { key: "createTime", label: "Create Time" },
  { key: "updateTime", label: "Update Time" },
];

export const meterTestTokenColumns: TableColumn[] = [
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "testToken", label: "Test Token" },
  { key: "createTime", label: "Create Time" },
  { key: "remark", label: "Remark" },
];

export const changeMeterKeyRecordColumns: TableColumn[] = [
  { key: "receiptId", label: "Receipt Id", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "token", label: "Token" },
  { key: "createTime", label: "Create Time" },
];

export const overdraftRecordColumns: TableColumn[] = [
  { key: "receiptId", label: "Receipt Id", searchable: true },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "maximumOverdraftLimit", label: "Max Overdraft Limit", align: "end" },
  { key: "createTime", label: "Create Time" },
];

export const theftSignalColumns: TableColumn[] = [
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "severity", label: "Severity" },
  { key: "score", label: "Score", align: "end" },
  { key: "signalTypes", label: "Signals" },
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "updatedAt", label: "Updated At" },
];

export const theftCaseColumns: TableColumn[] = [
  { key: "id", label: "Case Id", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "severity", label: "Severity" },
  { key: "score", label: "Score", align: "end" },
  { key: "status", label: "Status" },
  { key: "owner", label: "Owner", searchable: true },
  { key: "updatedAt", label: "Updated At" },
  { key: "notes", label: "Notes" },
];

export function filterField(
  key: string,
  label: string,
  placeholder: string,
  type: "text" | "date" | "number" = "text",
): FilterField {
  return { key, label, placeholder, type };
}

export function field(
  key: string,
  label: string,
  placeholder: string,
  type: "text" | "date" | "number" | "textarea" | "select" = "text",
): ActionField {
  return { key, label, placeholder, type };
}

export function selectField(
  key: string,
  label: string,
  placeholder: string,
  options: Array<{ label: string; value: string }>,
): ActionField {
  return { key, label, placeholder, type: "select", options };
}

export const remoteCommonFields: ActionField[] = [
  field("taskName", "Task Name", "Task name"),
  {
    ...field("scheduleDate", "Schedule Date", "Schedule date", "date"),
    helpText: "Leave empty to dispatch immediately.",
  },
];

export const readingTaskFields: ActionField[] = [
  ...remoteCommonFields,
  {
    ...field("dataItem", "Data Item", "Register / OBIS / item code"),
    required: true,
    helpText: "Provide the remote data identifier to read from the selected meter.",
  },
  selectField("readMode", "Read Mode", "Select read mode", [
    { label: "Single", value: "single" },
    { label: "Profile", value: "profile" },
    { label: "Instant", value: "instant" },
  ]),
];

export const settingTaskFields: ActionField[] = [
  ...remoteCommonFields,
  {
    ...field("settingKey", "Setting Key", "Setting key"),
    required: true,
    helpText: "The meter setting or parameter to update remotely.",
  },
  {
    ...field("settingValue", "Setting Value", "Setting value"),
    required: true,
  },
  selectField("valueType", "Value Type", "Select value type", [
    { label: "String", value: "string" },
    { label: "Number", value: "number" },
    { label: "HEX", value: "hex" },
    { label: "JSON", value: "json" },
  ]),
];

export const controlTaskFields: ActionField[] = [
  ...remoteCommonFields,
  {
    ...selectField("controlCommand", "Control Command", "Select command", [
      { label: "Connect", value: "connect" },
      { label: "Disconnect", value: "disconnect" },
      { label: "Open", value: "open" },
      { label: "Close", value: "close" },
    ]),
    required: true,
    helpText: "This command can change the remote relay or service state.",
  },
  {
    ...field("reason", "Reason", "Reason for command"),
    helpText: "Recommended for operator traceability.",
  },
  {
    ...field("operatorReason", "Operator Reason", "Reason for high-risk action"),
    required: true,
    helpText: "Required for high-risk command audit trail.",
  },
];

export const tokenTaskFields: ActionField[] = [
  ...remoteCommonFields,
  {
    ...selectField("tokenType", "Token Type", "Select token type", [
      { label: "Credit", value: "credit" },
      { label: "Clear Credit", value: "clear-credit" },
      { label: "Clear Tamper", value: "clear-tamper" },
      { label: "Change Key", value: "change-key" },
      { label: "Custom", value: "custom" },
    ]),
    required: true,
  },
  {
    ...field("tokenValue", "Token Value", "Token value"),
    helpText: "Sensitive values are redacted in the review step and logs.",
  },
  {
    ...field("operatorReason", "Operator Reason", "Reason for token operation"),
    required: true,
    helpText: "Required for high-risk command audit trail.",
  },
];

export const transparentForwardingFields: ActionField[] = [
  ...remoteCommonFields,
  {
    ...selectField("protocolMode", "Protocol Mode", "Select protocol mode", [
      { label: "HEX", value: "hex" },
      { label: "ASCII", value: "ascii" },
    ]),
    required: true,
  },
  {
    ...field("commandPayload", "Command Payload", "Raw command payload", "textarea"),
    required: true,
    helpText: "Paste the raw command body. The backend will redact this in logs.",
  },
  {
    ...field("timeoutSeconds", "Timeout (Seconds)", "Timeout", "number"),
    helpText: "Optional timeout between 1 and 300 seconds.",
  },
  {
    ...field("operatorReason", "Operator Reason", "Reason for raw forwarding command"),
    required: true,
    helpText: "Required for high-risk command audit trail.",
  },
];

export const customerManagementFields = [
  field("id", "Customer Id", "Customer id"),
  field("name", "Name", "Customer name"),
  field("phone", "Phone", "Phone number"),
  field("address", "Address", "Address"),
  field("certifiName", "Certifi Name", "Certificate name"),
  field("certifiNo", "Certifi No", "Certificate number"),
  field("remark", "Remark", "Optional note"),
  field("stationId", "Station Id", "Station id"),
];

export const accountManagementFields = [
  field("customerId", "Customer Id", "Customer id"),
  field("customerName", "Customer Name", "Customer name"),
  field("meterId", "Meter Id", "Meter id"),
  field("meterType", "Meter Type", "Meter type"),
  field("communicationWay", "Communication Way", "Communication way"),
  field("tariffId", "Tariff Id", "Tariff id"),
  field("protocolVersion", "Protocol Version", "Protocol version"),
  field("remark", "Remark", "Optional note"),
  field("stationId", "Station Id", "Station id"),
];

export const tariffManagementFields = [
  field("id", "Id", "Tariff id"),
  field("name", "Name", "Tariff name"),
  field("price", "Price", "Tariff price", "number"),
  field("remark", "Remark", "Optional note"),
];

export const gatewayManagementFields = [
  field("id", "Id", "Gateway id"),
  field("name", "Name", "Gateway name"),
  field("status", "Status", "Status"),
  field("successRate", "Success Rate", "Success rate", "number"),
  field("remark", "Remark", "Optional note"),
];

export const meterManagementFields = [
  field("meterId", "Meter Id", "Meter id"),
  field("meterType", "Meter Type", "Meter type"),
  field("customerId", "Customer Id", "Customer id"),
  field("customerName", "Customer Name", "Customer name"),
  field("communicationWay", "Communication Way", "Communication way"),
  field("protocolVersion", "Protocol Version", "Protocol version"),
  field("gatewayId", "Gateway Id", "Gateway id"),
  field("stationId", "Station Id", "Station id"),
  field("remark", "Remark", "Optional note"),
];

export const debtManagementFields = [
  field("customerId", "Customer Id", "Customer id"),
  field("customerName", "Customer Name", "Customer name"),
  field("meterId", "Meter Id", "Meter id"),
  field("amount", "Amount", "Debt amount", "number"),
  field("status", "Status", "Status"),
  field("remark", "Remark", "Optional note"),
];

export const dlmsManagementFields = [
  field("name", "Name", "DLMS object name"),
  field("obisCode", "OBIS Code", "e.g. 1.0.1.8.0.255"),
  field("classId", "Class Id", "Interface class"),
  field("attributeIndex", "Attribute Index", "Attribute index"),
  field("dataType", "Data Type", "Data type"),
  field("remark", "Remark", "Optional note"),
];

export const dlt645ManagementFields = [
  field("name", "Name", "Item name"),
  field("dataIdentifier", "Data Identifier", "Data identifier code"),
  field("dataLength", "Data Length", "Data length"),
  field("dataType", "Data Type", "Data type"),
  field("remark", "Remark", "Optional note"),
];

export const itemManagementFields = [
  field("name", "Name", "Item name"),
  field("unit", "Unit", "Unit of measurement"),
  field("dataType", "Data Type", "Data type"),
  field("remark", "Remark", "Optional note"),
];

export function createClientExportAction(endpoint: string): ActionConfig {
  return {
    key: "export",
    label: "Export",
    endpoint,
    tone: "neutral",
    operationKind: "client-export",
  };
}

export function createClientPrintAction(endpoint: string): ActionConfig {
  return {
    key: "print",
    label: "Print",
    endpoint,
    tone: "neutral",
    operationKind: "client-print",
  };
}

export function createImportAction(endpoint: string): ActionConfig {
  return {
    key: "import",
    label: "Import",
    endpoint,
    tone: "neutral",
    operationKind: "management-import",
    fields: [
      field(
        "importData",
        "CSV or JSON Records",
        "Paste CSV with headers or a JSON array of objects",
        "textarea",
      ),
    ],
  };
}

export function createTokenGenerateAction(options: {
  label: string;
  endpoint: string;
  operationKind: "token-generate-credit" | "token-generate-limit" | "token-generate-basic";
  successRedirectPath?: string;
}): ActionConfig {
  const fields: ActionField[] =
    options.operationKind === "token-generate-credit"
      ? [
          {
            key: "amount",
            label: "Amount",
            type: "number",
            placeholder: "Enter amount",
          },
          {
            key: "unit",
            label: "Unit",
            type: "number",
            placeholder: "Enter unit",
          },
        ]
      : options.operationKind === "token-generate-limit"
        ? [
            {
              key: "limitValue",
              label: "Limit Value",
              type: "number",
              placeholder: "Enter limit value",
            },
          ]
        : [];

  return {
    key: "generate",
    label: options.label,
    endpoint: options.endpoint,
    tone: "primary",
    operationKind: options.operationKind,
    fields,
    successRedirectPath: options.successRedirectPath,
  };
}

export function createTokenGeneratePage(
  path: string,
  title: string,
  menuLabel: string,
  endpoint: string,
  options: {
    actionLabel: string;
    showQuota: boolean;
    operationKind: "token-generate-credit" | "token-generate-limit" | "token-generate-basic";
    successRedirectPath?: string;
  },
): DataPageConfig {
  return {
    kind: "data",
    path,
    title,
    menuLabel,
    description: `${title} with account search, pagination, and action modal.`,
    sectionKey: "token-generate",
    readEndpoint: "/api/account/read",
    readOperationKind: "table-read",
    filters: [searchFilter],
    columns: tokenGenerateColumns,
    rowActions: [
      createTokenGenerateAction({
        label: options.actionLabel,
        endpoint,
        operationKind: options.operationKind,
        successRedirectPath: options.successRedirectPath,
      }),
    ],
    showQuota: options.showQuota,
    live: { enabled: true, intervalMs: 15_000, pauseOnHidden: true },
    actionPolicy: {
      guardedConfirm: true,
      requireReasonForHighRisk: false,
    },
  };
}

interface TokenRecordPageOptions {
  columns: TableColumn[];
  filters?: FilterField[];
  toolbarActions?: ActionConfig[];
  rowActions?: ActionConfig[];
}

export function createTokenRecordPage(
  path: string,
  title: string,
  menuLabel: string,
  readEndpoint: string,
  options: TokenRecordPageOptions,
): DataPageConfig {
  return {
    kind: "data",
    path,
    title,
    menuLabel,
    description: `${title} backed by the documented upstream record endpoint.`,
    sectionKey: "token-record",
    readEndpoint,
    readOperationKind: "table-read",
    filters: options.filters ?? [searchFilter],
    columns: options.columns,
    toolbarActions: [createClientExportAction(readEndpoint), ...(options.toolbarActions ?? [])],
    rowActions: [createClientPrintAction(readEndpoint), ...(options.rowActions ?? [])],
    live: { enabled: true, intervalMs: 8_000, pauseOnHidden: true, critical: true },
    riskIntegration: {
      canOpenCase: true,
      riskSignals: ["token-anomaly", "repeat-cancel", "abnormal-vend"],
    },
  };
}

export function createRemoteOperationPage(
  path: string,
  title: string,
  menuLabel: string,
  endpoint: string,
  options: {
    remoteTaskType: "reading" | "setting" | "control" | "token" | "transparent-forwarding";
    payloadBuilderKey: "reading" | "setting" | "control" | "token" | "transparent-forwarding";
    fields: ActionField[];
    dangerLevel: "low" | "medium" | "high";
    requiresReviewStep?: boolean;
    confirmMessage?: string;
    successRedirectPath: string;
  },
): DataPageConfig {
  return {
    kind: "data",
    path,
    title,
    menuLabel,
    description: `${title} with meter search and task creation flow.`,
    sectionKey: "remote-operation",
    readEndpoint: "/api/meter/read",
    readOperationKind: "table-read",
    filters: [searchFilter],
    columns: remoteColumns,
    toolbarActions: [
      {
        key: "remote-command",
        label: options.requiresReviewStep ? "Review Command" : "Submit Command",
        endpoint,
        tone: options.dangerLevel === "high" ? "danger" : "primary",
        operationKind: "task-create",
        remoteTaskType: options.remoteTaskType,
        payloadBuilderKey: options.payloadBuilderKey,
        dangerLevel: options.dangerLevel,
        riskLevel: options.dangerLevel,
        requiresReason: options.dangerLevel === "high",
        requiresReviewStep: options.requiresReviewStep,
        confirmMessage: options.confirmMessage,
        successRedirectPath: options.successRedirectPath,
        fields: options.fields,
      },
    ],
    live: { enabled: true, intervalMs: 12_000, pauseOnHidden: true },
  };
}

interface TaskPageOptions {
  columns?: TableColumn[];
  filters?: FilterField[];
  toolbarActions?: ActionConfig[];
  rowActions?: ActionConfig[];
  description?: string;
}

export function createReadOnlyTaskPage(
  path: string,
  title: string,
  menuLabel: string,
  readEndpoint: string,
  options: TaskPageOptions = {},
): DataPageConfig {
  return {
    kind: "data",
    path,
    title,
    menuLabel,
    description: options.description ?? `${title} for monitoring queued operations.`,
    sectionKey: "remote-operation-task",
    readEndpoint,
    readOperationKind: "task-read",
    filters: options.filters ?? [searchFilter, ...dateRangeFilters],
    columns: options.columns ?? genericTaskColumns,
    toolbarActions: [createClientExportAction(readEndpoint), ...(options.toolbarActions ?? [])],
    rowActions: options.rowActions,
    live: { enabled: true, intervalMs: 3_000, pauseOnHidden: true, critical: true },
    riskIntegration: {
      canOpenCase: true,
      riskSignals: ["remote-task-failure", "suspicious-control-pattern"],
    },
  };
}

interface ManagementPageOptions {
  formFields?: NonNullable<ActionConfig["fields"]>;
  extraRowActions?: ActionConfig[];
  sectionKey?: string;
  actionBasePath?: string;
}

export function createManagementPage(
  path: string,
  title: string,
  menuLabel: string,
  readEndpoint: string,
  columns: TableColumn[],
  options: ManagementPageOptions = {},
): DataPageConfig {
  const actionBaseSource = options.actionBasePath ?? readEndpoint;
  const base = actionBaseSource.replace("/read", "").replace("/Read", "");
  const usesUppercaseRead = actionBaseSource.includes("/Read");
  const createPath = usesUppercaseRead ? `${base}/Create` : `${base}/create`;
  const updatePath = usesUppercaseRead ? `${base}/Update` : `${base}/update`;
  const deletePath = usesUppercaseRead ? `${base}/Delete` : `${base}/delete`;
  const importPath = usesUppercaseRead ? `${base}/Import` : `${base}/import`;
  const formFields = options.formFields ?? [
    field("name", "Name", `${menuLabel} name`),
    field("remark", "Remark", "Optional note"),
  ];

  return {
    kind: "data",
    path,
    title,
    menuLabel,
    description: `${title} with standard CRUD and bulk actions.`,
    sectionKey: options.sectionKey ?? "management",
    readEndpoint,
    readOperationKind: "table-read",
    filters: [searchFilter],
    columns,
    live: { enabled: false, intervalMs: 0, pauseOnHidden: true },
    toolbarActions: [
      {
        key: "add",
        label: "Add",
        endpoint: createPath,
        tone: "primary",
        operationKind: "management-create",
        fields: formFields,
      },
      createImportAction(importPath),
      createClientExportAction(readEndpoint),
    ],
    bulkActions: [
      {
        key: "bulk-delete",
        label: "Delete Selected",
        endpoint: deletePath,
        tone: "danger",
        operationKind: "bulk-delete",
        confirmMessage: "Delete the selected records?",
      },
    ],
    rowActions: [
      {
        key: "edit",
        label: "Edit",
        endpoint: updatePath,
        tone: "primary",
        operationKind: "management-update",
        fields: formFields,
      },
      {
        key: "delete",
        label: "Delete",
        endpoint: deletePath,
        tone: "danger",
        operationKind: "management-delete",
        confirmMessage: "Delete this record?",
      },
      ...(options.extraRowActions ?? []),
    ],
  };
}
