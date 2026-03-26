import type {
  ActionConfig,
  ActionField,
  AppPageConfig,
  DataPageConfig,
  FilterField,
  NavigationSection,
  SidebarIconKey,
  TableColumn,
} from "../types";

const searchFilter: FilterField = {
  key: "searchTerm",
  label: "Search",
  placeholder: "Search by keyword",
  type: "text",
};

const dateRangeFilters: FilterField[] = [
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

const accountColumns: TableColumn[] = [
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

const tokenGenerateColumns: TableColumn[] = [
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "meterType", label: "Meter Type" },
  { key: "tariffId", label: "Tariff Id" },
  { key: "protocolVersion", label: "Protocol Version" },
  { key: "createTime", label: "Create Time" },
];

const creditTokenRecordColumns: TableColumn[] = [
  { key: "receiptId", label: "Receipt Id", searchable: true },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "meterType", label: "Meter Type" },
  { key: "tariffId", label: "Tariff Id" },
  { key: "vatCharge", label: "VAT Charge", align: "end" },
  { key: "totalUnit", label: "Total Unit", align: "end" },
  { key: "totalPrice", label: "Total Paid", align: "end" },
  { key: "tokenRecharge", label: "Recharge(kwh)", align: "end" },
  { key: "createId", label: "Vend" },
  { key: "token", label: "Token" },
  { key: "createTime", label: "Time" },
  { key: "remark", label: "Remark" },
  { key: "stationId", label: "Station Id" },
];

const clearTokenRecordColumns: TableColumn[] = [
  { key: "receiptId", label: "Receipt Id", searchable: true },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "tokenRecharge", label: "Token", align: "end" },
  { key: "createTime", label: "Create Time" },
  { key: "stationId", label: "Station Id" },
];

const maximumPowerRecordColumns: TableColumn[] = [
  { key: "receiptId", label: "Receipt Id", searchable: true },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "maximumPowerLimit", label: "Maximum Power Limit", align: "end" },
];

const remoteColumns: TableColumn[] = [
  { key: "status", label: "Status" },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "meterType", label: "Meter Type" },
  { key: "remark", label: "Remark" },
  { key: "stationId", label: "Station Id" },
];

const genericTaskColumns: TableColumn[] = [
  { key: "status", label: "Status" },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "createTime", label: "Create Time" },
  { key: "remark", label: "Remark" },
  { key: "stationId", label: "Station Id" },
];

const meterReadingTaskColumns: TableColumn[] = [
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

const meterControlTaskColumns: TableColumn[] = [
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "dataItem", label: "Data Item" },
  { key: "site", label: "Site" },
];

const meterTokenTaskColumns: TableColumn[] = [
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "dataItem", label: "Data Item" },
  { key: "token", label: "Token" },
];

const intervalColumns: TableColumn[] = [
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

const customerColumns: TableColumn[] = [
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

const tariffColumns: TableColumn[] = [
  { key: "id", label: "Id", searchable: true },
  { key: "name", label: "Name", searchable: true },
  { key: "price", label: "Price", align: "end" },
  { key: "remark", label: "Remark" },
  { key: "createTime", label: "Create Time" },
  { key: "updateTime", label: "Update Time" },
];

const gatewayColumns: TableColumn[] = [
  { key: "status", label: "Status" },
  { key: "successRate", label: "Success Rate", align: "end" },
  { key: "id", label: "Id", searchable: true },
  { key: "name", label: "Name", searchable: true },
];

function filterField(
  key: string,
  label: string,
  placeholder: string,
  type: "text" | "date" | "number" = "text",
): FilterField {
  return {
    key,
    label,
    placeholder,
    type,
  };
}

function field(
  key: string,
  label: string,
  placeholder: string,
  type: "text" | "date" | "number" | "textarea" = "text",
): ActionField {
  return {
    key,
    label,
    placeholder,
    type,
  };
}

const customerManagementFields = [
  field("id", "Customer Id", "Customer id"),
  field("name", "Name", "Customer name"),
  field("phone", "Phone", "Phone number"),
  field("address", "Address", "Address"),
  field("certifiName", "Certifi Name", "Certificate name"),
  field("certifiNo", "Certifi No", "Certificate number"),
  field("remark", "Remark", "Optional note"),
  field("stationId", "Station Id", "Station id"),
];

const accountManagementFields = [
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

const tariffManagementFields = [
  field("id", "Id", "Tariff id"),
  field("name", "Name", "Tariff name"),
  field("price", "Price", "Tariff price", "number"),
  field("remark", "Remark", "Optional note"),
];

const gatewayManagementFields = [
  field("id", "Id", "Gateway id"),
  field("name", "Name", "Gateway name"),
  field("status", "Status", "Status"),
  field("successRate", "Success Rate", "Success rate", "number"),
  field("remark", "Remark", "Optional note"),
];

function createClientExportAction(endpoint: string): ActionConfig {
  return {
    key: "export",
    label: "Export",
    endpoint,
    tone: "neutral",
    operationKind: "client-export",
  };
}

function createClientPrintAction(endpoint: string): ActionConfig {
  return {
    key: "print",
    label: "Print",
    endpoint,
    tone: "neutral",
    operationKind: "client-print",
  };
}

function createImportAction(endpoint: string): ActionConfig {
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

function createRechargeAction(label: string, endpoint: string): ActionConfig {
  return {
    key: "generate",
    label,
    endpoint,
    tone: "primary",
    operationKind: "token-generate",
    fields: [
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
    ],
  };
}

function createTokenGeneratePage(
  path: string,
  title: string,
  menuLabel: string,
  endpoint: string,
  options: {
    actionLabel: string;
    showQuota: boolean;
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
    rowActions: [createRechargeAction(options.actionLabel, endpoint)],
    showQuota: options.showQuota,
  };
}

interface TokenRecordPageOptions {
  columns: TableColumn[];
  toolbarActions?: ActionConfig[];
  rowActions?: ActionConfig[];
}

function createTokenRecordPage(
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
    filters: [searchFilter],
    columns: options.columns,
    toolbarActions: [createClientExportAction(readEndpoint), ...(options.toolbarActions ?? [])],
    rowActions: [createClientPrintAction(readEndpoint), ...(options.rowActions ?? [])],
  };
}

function createRemoteOperationPage(
  path: string,
  title: string,
  menuLabel: string,
  endpoint: string,
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
        key: "batch",
        label: "Add Batch Task",
        endpoint,
        tone: "primary",
        operationKind: "task-create",
        fields: [
          {
            key: "taskName",
            label: "Task Name",
            placeholder: "Task name",
          },
          {
            key: "scheduleDate",
            label: "Schedule Date",
            placeholder: "Schedule date",
            type: "date",
          },
        ],
      },
    ],
    rowActions: [
      {
        key: "single",
        label: "Add Task",
        endpoint,
        tone: "primary",
        operationKind: "task-create",
        fields: [
          {
            key: "taskName",
            label: "Task Name",
            placeholder: "Task name",
          },
        ],
      },
    ],
  };
}

interface TaskPageOptions {
  columns?: TableColumn[];
  filters?: FilterField[];
  toolbarActions?: ActionConfig[];
  rowActions?: ActionConfig[];
  description?: string;
}

function createReadOnlyTaskPage(
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
  };
}

interface ManagementPageOptions {
  formFields?: NonNullable<ActionConfig["fields"]>;
  extraRowActions?: ActionConfig[];
}

function createManagementPage(
  path: string,
  title: string,
  menuLabel: string,
  readEndpoint: string,
  columns: TableColumn[],
  options: ManagementPageOptions = {},
): DataPageConfig {
  const base = readEndpoint.replace("/read", "");
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
    sectionKey: "management",
    readEndpoint,
    readOperationKind: "table-read",
    filters: [searchFilter],
    columns,
    toolbarActions: [
      {
        key: "add",
        label: "Add",
        endpoint: `${base}/create`,
        tone: "primary",
        operationKind: "management-create",
        fields: formFields,
      },
      createImportAction(`${base}/create`),
      createClientExportAction(readEndpoint),
    ],
    bulkActions: [
      {
        key: "bulk-delete",
        label: "Delete Selected",
        endpoint: `${base}/delete`,
        tone: "danger",
        operationKind: "bulk-delete",
        confirmMessage: "Delete the selected records?",
      },
    ],
    rowActions: [
      {
        key: "edit",
        label: "Edit",
        endpoint: `${base}/update`,
        tone: "primary",
        operationKind: "management-update",
        fields: formFields,
      },
      {
        key: "delete",
        label: "Delete",
        endpoint: `${base}/delete`,
        tone: "danger",
        operationKind: "management-delete",
        confirmMessage: "Delete this record?",
      },
      ...(options.extraRowActions ?? []),
    ],
  };
}

const pages: AppPageConfig[] = [
  {
    kind: "dashboard",
    path: "/dashboard",
    title: "Dashboard",
    menuLabel: "Dashboard",
    description: "Overview of KPIs, purchase patterns, alarms, and consumption.",
    sectionKey: "dashboard",
  },
  createTokenGeneratePage(
    "/token-generate/credit-token",
    "Credit Token",
    "Credit Token",
    "/api/token/creditToken/generate",
    {
      actionLabel: "Recharge",
      showQuota: true,
    },
  ),
  createTokenGeneratePage(
    "/token-generate/clear-tamper-token",
    "Clear Tamper Token",
    "Clear Tamper Token",
    "/api/token/clearTamperToken/generate",
    {
      actionLabel: "Generate Token",
      showQuota: false,
    },
  ),
  createTokenGeneratePage(
    "/token-generate/clear-credit-token",
    "Clear Credit Token",
    "Clear Credit Token",
    "/api/token/clearCreditToken/generate",
    {
      actionLabel: "Generate Token",
      showQuota: false,
    },
  ),
  createTokenGeneratePage(
    "/token-generate/set-max-power-limit-token",
    "Set Maximum Power Limit Token",
    "Set Maximum Power Limit",
    "/api/token/setMaximumPowerLimitToken/generate",
    {
      actionLabel: "Generate Token",
      showQuota: false,
    },
  ),
  createTokenRecordPage(
    "/token-record/credit-token-record",
    "Credit Token Record",
    "Credit Token Record",
    "/api/token/creditTokenRecord/read",
    {
      columns: creditTokenRecordColumns,
      rowActions: [
        {
          key: "cancel",
          label: "Cancel",
          endpoint: "/api/token/creditTokenRecord/cancel",
          tone: "danger",
          operationKind: "record-cancel",
          confirmMessage: "Cancel this record?",
        },
      ],
    },
  ),
  createTokenRecordPage(
    "/token-record/clear-tamper-record",
    "Clear Tamper Record",
    "Clear Tamper Record",
    "/api/token/clearTamperTokenRecord/read",
    {
      columns: clearTokenRecordColumns,
    },
  ),
  createTokenRecordPage(
    "/token-record/clear-credit-record",
    "Clear Credit Record",
    "Clear Credit Record",
    "/api/token/clearCreditTokenRecord/read",
    {
      columns: clearTokenRecordColumns,
    },
  ),
  createTokenRecordPage(
    "/token-record/set-max-power-limit-record",
    "Set Maximum Power Limit Record",
    "Set Maximum Power Record",
    "/api/token/setMaximumPowerLimitTokenRecord/read",
    {
      columns: maximumPowerRecordColumns,
    },
  ),
  createRemoteOperationPage(
    "/remote-operation/meter-reading",
    "Meter Reading",
    "Meter Reading",
    "/API/RemoteMeterTask/CreateReadingTask",
  ),
  createRemoteOperationPage(
    "/remote-operation/meter-control",
    "Meter Control",
    "Meter Control",
    "/API/RemoteMeterTask/CreateControlTask",
  ),
  createRemoteOperationPage(
    "/remote-operation/meter-token",
    "Meter Token",
    "Meter Token",
    "/API/RemoteMeterTask/CreateTokenTask",
  ),
  createReadOnlyTaskPage(
    "/remote-operation-task/meter-reading-task",
    "Meter Reading Task",
    "Meter Reading Task",
    "/API/RemoteMeterTask/GetReadingTask",
    {
      columns: meterReadingTaskColumns,
      filters: [searchFilter],
    },
  ),
  createReadOnlyTaskPage(
    "/remote-operation-task/meter-control-task",
    "Meter Control Task",
    "Meter Control Task",
    "/API/RemoteMeterTask/GetControlTask",
    {
      columns: meterControlTaskColumns,
      filters: [searchFilter],
    },
  ),
  createReadOnlyTaskPage(
    "/remote-operation-task/meter-token-task",
    "Meter Token Task",
    "Meter Token Task",
    "/API/RemoteMeterTask/GetTokenTask",
    {
      columns: meterTokenTaskColumns,
      filters: [searchFilter],
    },
  ),
  {
    kind: "data",
    path: "/data-report/long-nonpurchase",
    title: "Long Nonpurchase Situation",
    menuLabel: "Long Nonpurchase",
    description: "Report view for long nonpurchase trends.",
    sectionKey: "data-report",
    readEndpoint: "/API/PrepayReport/LongNonpurchaseSituation",
    readOperationKind: "report-read",
    filters: [
      filterField("customerId", "Customer Id", "Customer id"),
      filterField("meterId", "Meter Id", "Meter id"),
      filterField("nonpurchaseDaysStart", "Nonpurchase Days Start", "Start days", "number"),
      filterField("nonpurchaseDaysEnd", "Nonpurchase Days End", "End days", "number"),
    ],
    columns: [
      { key: "customerId", label: "Customer Id" },
      { key: "customerName", label: "Customer Name" },
      { key: "meterId", label: "Meter Id" },
      { key: "tariff", label: "Tariff" },
    ],
  },
  {
    kind: "data",
    path: "/data-report/low-purchase",
    title: "Low Purchase Situation",
    menuLabel: "Low Purchase",
    description: "Report view for low purchase accounts and balances.",
    sectionKey: "data-report",
    readEndpoint: "/API/PrepayReport/LowPurchaseSituation",
    readOperationKind: "report-read",
    filters: [
      filterField("customerId", "Customer Id", "Customer id"),
      filterField("meterId", "Meter Id", "Meter id"),
      ...dateRangeFilters,
      filterField("lowLimit", "Low Limit", "Low balance threshold", "number"),
    ],
    columns: [
      { key: "customerId", label: "Customer Id" },
      { key: "customerName", label: "Customer Name" },
      { key: "meterId", label: "Meter Id" },
      { key: "tariffId", label: "Tariff Id" },
      { key: "totalUnit", label: "Total Unit", align: "end" },
      { key: "totalPaid", label: "Total Paid", align: "end" },
      { key: "customerAddress", label: "Customer Address" },
    ],
  },
  {
    kind: "data",
    path: "/data-report/consumption-statistics",
    title: "Consumption Statistics",
    menuLabel: "Consumption Statistics",
    description: "Report view for aggregated consumption performance.",
    sectionKey: "data-report",
    readEndpoint: "/API/PrepayReport/ConsumptionStatistics",
    readOperationKind: "report-read",
    filters: [
      filterField("customerId", "Customer Id", "Customer id"),
      filterField("meterId", "Meter Id", "Meter id"),
      ...dateRangeFilters,
    ],
    columns: [
      { key: "collectionDate", label: "Collection Date" },
      { key: "consumption", label: "Consumption", align: "end" },
    ],
  },
  {
    kind: "data",
    path: "/data-report/interval-data",
    title: "Interval Data",
    menuLabel: "Interval Data",
    description: "Interval report with meter drill-down action for hourly views.",
    sectionKey: "data-report",
    readEndpoint: "/api/DailyDataMeter/read",
    readOperationKind: "report-read",
    filters: [searchFilter],
    columns: intervalColumns,
    rowActions: [
      {
        key: "hourly",
        label: "Hourly",
        endpoint: "/api/DailyDataMeter/readHourly",
        tone: "primary",
        operationKind: "generic",
      },
    ],
    toolbarActions: [
      {
        key: "monthly",
        label: "Monthly View",
        endpoint: "/api/DailyDataMeter/readMonthly",
        tone: "neutral",
        operationKind: "generic",
      },
    ],
  },
  createManagementPage(
    "/management/customer",
    "Customer Management",
    "Customer",
    "/api/customer/read",
    customerColumns,
    {
      formFields: customerManagementFields,
    },
  ),
  createManagementPage(
    "/management/account",
    "Account Management",
    "Account",
    "/api/account/read",
    accountColumns,
    {
      formFields: accountManagementFields,
    },
  ),
  createManagementPage(
    "/management/tariff",
    "Tariff Management",
    "Tariff",
    "/api/tariff/read",
    tariffColumns,
    {
      formFields: tariffManagementFields,
    },
  ),
  createManagementPage(
    "/management/gateway",
    "Gateway Management",
    "Gateway",
    "/api/gateway/read",
    gatewayColumns,
    {
      formFields: gatewayManagementFields,
    },
  ),
  {
    kind: "profile",
    path: "/profile",
    title: "Profile",
    menuLabel: "Profile",
    description: "Modify account information, login password, and authorization password.",
    sectionKey: "management",
    includeInNavigation: false,
  },
];

const sectionDefinitions: Array<{
  key: string;
  label: string;
  iconKey: SidebarIconKey;
}> = [
  { key: "dashboard", label: "Dashboard", iconKey: "dashboard" },
  { key: "token-generate", label: "Token Generate", iconKey: "token-generate" },
  { key: "token-record", label: "Token Record", iconKey: "token-record" },
  { key: "remote-operation", label: "Remote Operation", iconKey: "remote-operation" },
  { key: "remote-operation-task", label: "Remote Operation Task", iconKey: "remote-operation-task" },
  { key: "data-report", label: "Data Report", iconKey: "data-report" },
  { key: "management", label: "Management", iconKey: "management" },
];

export const defaultPath = "/dashboard";
export const allPages = pages;
export const pagesByPath = Object.fromEntries(
  pages.map((page) => [page.path, page]),
) as Record<string, AppPageConfig>;

export const navigationSections: NavigationSection[] = sectionDefinitions.map(
  (section): NavigationSection => ({
    key: section.key,
    label: section.label,
    iconKey: section.iconKey,
    items: pages.filter(
      (page) => page.sectionKey === section.key && page.includeInNavigation !== false,
    ),
  }),
);
