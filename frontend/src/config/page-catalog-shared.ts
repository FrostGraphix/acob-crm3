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
    key: "tariffId",
    label: "Tariff Id",
    placeholder: "Search tariff id",
    type: "text",
  },
  {
    key: "totalPaid",
    label: "Total Paid",
    placeholder: "Search total paid",
    type: "number",
  },
  {
    key: "totalUnit",
    label: "Total Unit",
    placeholder: "Search total unit",
    type: "number",
  },
  {
    key: "status",
    label: "Status",
    placeholder: "Search status",
    type: "text",
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

export const tokenAuditFilters: FilterField[] = [
  ...dateRangeFilters,
  searchFilter,
  filterField("receiptId", "Receipt Id", "Search receipt id"),
  filterField("customerId", "Customer Id", "Search customer id"),
  filterField("customerName", "Customer Name", "Search customer name"),
  filterField("meterId", "Meter Id", "Search meter id"),
  filterField("status", "Status", "Search status"),
  filterField("stationId", "Station Id", "Search station id"),
];

export const remoteTaskFilters: FilterField[] = [
  searchFilter,
  filterField("id", "Task Id", "Search task id"),
  filterField("name", "Task Name", "Search task name"),
  filterField("customerId", "Customer Id", "Search customer id"),
  filterField("customerName", "Customer Name", "Search customer name"),
  filterField("meterId", "Meter Id", "Search meter id"),
  filterField("status", "Status", "Search status"),
  filterField("stationId", "Station Id", "Search station id"),
  filterField("lang", "Lang", "Search language"),
  ...dateRangeFilters,
];

export const loadProfileFilters: FilterField[] = [
  searchFilter,
  filterField("customerId", "Customer Id", "Search customer id"),
  filterField("customerName", "Customer Name", "Search customer name"),
  filterField("meterId", "Meter Id", "Search meter id"),
  filterField("stationId", "Station Id", "Search station id"),
  filterField("isThreePhase", "Three Phase", "true / false"),
  ...dateRangeFilters,
];

export const eventNotificationFilters: FilterField[] = [
  searchFilter,
  filterField("meterId", "Meter Id", "Search meter id"),
  filterField("eventCode", "Event Code", "Search event code"),
  filterField("stationId", "Station Id", "Search station id"),
  ...dateRangeFilters,
];

export const accountColumns: TableColumn[] = [
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "oldMeterId", label: "Old Meter Id", searchable: true },
  { key: "meterType", label: "Meter Type" },
  { key: "ctRatio", label: "CT Ratio", align: "end" },
  { key: "communicationWay", label: "Communication Way" },
  { key: "tariffId", label: "Tariff Id" },
  { key: "protocolVersion", label: "Protocol Version" },
  { key: "status", label: "Status" },
  { key: "remark", label: "Remark" },
  { key: "createTime", label: "Create Time" },
  { key: "updateTime", label: "Update Time" },
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
  { key: "totalUnit", label: "Total Unit", align: "end", searchable: true },
  { key: "totalPaid", label: "Total Paid", align: "end", searchable: true },
  { key: "tax", label: "Tax", align: "end", searchable: true },
  { key: "monthlyCharge", label: "Monthly Charge", align: "end", searchable: true },
  { key: "totalDebt", label: "Total Debt", align: "end", searchable: true },
  { key: "remainingDebt", label: "Remaining Debt", align: "end", searchable: true },
  { key: "payDebt", label: "Pay Debt", align: "end", searchable: true },
  { key: "vatCharge", label: "VAT Charge", align: "end", searchable: true },
  { key: "communicationWay", label: "Communication Way", searchable: true },
  { key: "createId", label: "Vend", searchable: true },
  { key: "token", label: "Token", searchable: true },
  { key: "status", label: "Status", searchable: true },
  { key: "createTime", label: "Time", searchable: true },
  { key: "updateTime", label: "Update Time", searchable: true },
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
  { key: "meterType", label: "Meter Type" },
  { key: "maximumPowerLimit", label: "Maximum Power Limit", align: "end" },
  { key: "status", label: "Status" },
  { key: "remark", label: "Remark" },
  { key: "createTime", label: "Create Time" },
  { key: "stationId", label: "Station Id" },
];

export const maximumPhaseUnbalanceRecordColumns: TableColumn[] = [
  { key: "receiptId", label: "Receipt Id", searchable: true },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "meterType", label: "Meter Type" },
  { key: "maximumPhasePowerUnbalanceLimit", label: "Maximum Phase Power Unbalance Limit", align: "end" },
  { key: "status", label: "Status" },
  { key: "remark", label: "Remark" },
  { key: "createTime", label: "Create Time" },
  { key: "stationId", label: "Station Id" },
];

export const maximumOverdraftRecordColumns: TableColumn[] = [
  { key: "receiptId", label: "Receipt Id", searchable: true },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "meterType", label: "Meter Type" },
  { key: "maximumOverdraftLimit", label: "Maximum Overdraft Limit", align: "end" },
  { key: "status", label: "Status" },
  { key: "remark", label: "Remark" },
  { key: "createTime", label: "Create Time" },
  { key: "stationId", label: "Station Id" },
];

export const changeMeterKeyRecordColumns: TableColumn[] = [
  { key: "receiptId", label: "Receipt Id", searchable: true },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "meterType", label: "Meter Type" },
  { key: "token", label: "Token", searchable: true },
  { key: "status", label: "Status" },
  { key: "createTime", label: "Create Time" },
  { key: "remark", label: "Remark" },
  { key: "stationId", label: "Station Id" },
];

export const meterTestTokenRecordColumns: TableColumn[] = [
  { key: "receiptId", label: "Receipt Id", searchable: true },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "meterType", label: "Meter Type" },
  { key: "token", label: "Token", searchable: true },
  { key: "status", label: "Status" },
  { key: "createTime", label: "Create Time" },
  { key: "remark", label: "Remark" },
  { key: "stationId", label: "Station Id" },
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
  { key: "__taskSource", label: "Channel" },
  { key: "taskCategory", label: "Task Type" },
  { key: "id", label: "Task Id", searchable: true },
  { key: "name", label: "Task Name", searchable: true },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "status", label: "Status" },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "dataItem", label: "Data Item" },
  { key: "dataPrefix", label: "Data Prefix" },
  { key: "data", label: "Data" },
  { key: "concentratorId", label: "Concentrator Id" },
  { key: "gatewayId", label: "Gateway Id" },
  { key: "lang", label: "Lang" },
  { key: "createTime", label: "Create Time" },
  { key: "updateTime", label: "Update Time" },
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
  { key: "__taskSource", label: "Channel" },
  { key: "taskCategory", label: "Task Type" },
  { key: "id", label: "Task Id", searchable: true },
  { key: "name", label: "Task Name", searchable: true },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "dataItem", label: "Data Item" },
  { key: "dataPrefix", label: "Data Prefix" },
  { key: "data", label: "Raw Data" },
  { key: "concentratorId", label: "Concentrator Id" },
  { key: "gatewayId", label: "Gateway Id" },
  { key: "remark", label: "Remark" },
  { key: "lang", label: "Lang" },
  { key: "status", label: "Status" },
  { key: "createTime", label: "Create Time" },
  { key: "updateTime", label: "Update Time" },
  { key: "stationId", label: "Station Id" },
];

export const meterTokenTaskColumns: TableColumn[] = [
  { key: "__taskSource", label: "Channel" },
  { key: "taskCategory", label: "Task Type" },
  { key: "id", label: "Task Id", searchable: true },
  { key: "name", label: "Task Name", searchable: true },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "dataItem", label: "Data Item" },
  { key: "token", label: "Token" },
  { key: "data", label: "Raw Data" },
  { key: "dataPrefix", label: "Data Prefix" },
  { key: "concentratorId", label: "Concentrator Id" },
  { key: "gatewayId", label: "Gateway Id" },
  { key: "remark", label: "Remark" },
  { key: "lang", label: "Lang" },
  { key: "status", label: "Status" },
  { key: "createTime", label: "Create Time" },
  { key: "updateTime", label: "Update Time" },
  { key: "stationId", label: "Station Id" },
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
  { key: "id", label: "Customer Id", searchable: true },
  { key: "name", label: "Customer Name", searchable: true },
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
  { key: "id", label: "Tariff Id", searchable: true },
  { key: "name", label: "Tariff Name", searchable: true },
  { key: "price", label: "Price", align: "end" },
  { key: "remark", label: "Remark" },
  { key: "createTime", label: "Create Time" },
  { key: "updateTime", label: "Update Time" },
];

export const gatewayColumns: TableColumn[] = [
  { key: "status", label: "Status" },
  { key: "successRate", label: "Success Rate", align: "end" },
  { key: "id", label: "Gateway Id", searchable: true },
  { key: "name", label: "Gateway Name", searchable: true },
];

export const meterColumns: TableColumn[] = [
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "type", label: "Type" },
  { key: "meterType", label: "Meter Type" },
  { key: "isThreePhase", label: "Three Phase" },
  { key: "communicationWay", label: "Communication Way" },
  { key: "protocolVersion", label: "Protocol Version" },
  { key: "lat", label: "Latitude", align: "end" },
  { key: "lng", label: "Longitude", align: "end" },
  { key: "baseYear", label: "Base Year" },
  { key: "sgc", label: "SGC" },
  { key: "krn", label: "KRN" },
  { key: "ken", label: "KEN" },
  { key: "ti", label: "TI" },
  { key: "kt", label: "KT" },
  { key: "stationId", label: "Station Id" },
  { key: "status", label: "Status" },
  { key: "createTime", label: "Create Time" },
  { key: "updateTime", label: "Update Time" },
];

export const debtColumns: TableColumn[] = [
  { key: "id", label: "Id", searchable: true },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "totalDebt", label: "Total Debt", align: "end" },
  { key: "amount", label: "Legacy Amount", align: "end" },
  { key: "status", label: "Status" },
  { key: "remark", label: "Remark" },
  { key: "createTime", label: "Create Time" },
  { key: "updateTime", label: "Update Time" },
  { key: "stationId", label: "Station Id" },
];

export const stationColumns: TableColumn[] = [
  { key: "stationId", label: "Station Id", searchable: true },
  { key: "stationName", label: "Station Name", searchable: true },
  { key: "name", label: "Name", searchable: true },
  { key: "address", label: "Address", searchable: true },
  { key: "lat", label: "Latitude", align: "end" },
  { key: "lng", label: "Longitude", align: "end" },
  { key: "remark", label: "Remark" },
  { key: "createTime", label: "Create Time" },
  { key: "updateTime", label: "Update Time" },
];

export const roleColumns: TableColumn[] = [
  { key: "roleId", label: "Role Id", searchable: true },
  { key: "roleName", label: "Role Name", searchable: true },
  { key: "name", label: "Name", searchable: true },
  { key: "description", label: "Description", searchable: true },
  { key: "remark", label: "Remark" },
  { key: "createTime", label: "Create Time" },
  { key: "updateTime", label: "Update Time" },
];

export const userAdminColumns: TableColumn[] = [
  { key: "userId", label: "User Id", searchable: true },
  { key: "username", label: "Username", searchable: true },
  { key: "name", label: "Name", searchable: true },
  { key: "roleId", label: "Role Id", searchable: true },
  { key: "roleName", label: "Role Name", searchable: true },
  { key: "phone", label: "Phone", searchable: true },
  { key: "email", label: "Email", searchable: true },
  { key: "stationId", label: "Station Id" },
  { key: "status", label: "Status" },
  { key: "createTime", label: "Create Time" },
  { key: "updateTime", label: "Update Time" },
];

export const gprsOnlineStatusColumns: TableColumn[] = [
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "gatewayId", label: "Gateway Id", searchable: true },
  { key: "onlineStatus", label: "Online Status" },
  { key: "status", label: "Status" },
  { key: "lastOnlineTime", label: "Last Online Time" },
  { key: "lastOfflineTime", label: "Last Offline Time" },
  { key: "ip", label: "IP Address" },
  { key: "stationId", label: "Station Id" },
  { key: "remark", label: "Remark" },
];

export const updateFirmwareTaskColumns: TableColumn[] = [
  { key: "id", label: "Task Id", searchable: true },
  { key: "name", label: "Task Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "gatewayId", label: "Gateway Id", searchable: true },
  { key: "concentratorId", label: "Concentrator Id", searchable: true },
  { key: "fileName", label: "File Name", searchable: true },
  { key: "fileUrl", label: "File URL" },
  { key: "firmwareVersion", label: "Firmware Version" },
  { key: "status", label: "Status" },
  { key: "progress", label: "Progress", align: "end" },
  { key: "createTime", label: "Create Time" },
  { key: "updateTime", label: "Update Time" },
  { key: "stationId", label: "Station Id" },
  { key: "remark", label: "Remark" },
];

export const dailyDataColumns: TableColumn[] = [
  ...intervalColumns,
  { key: "day", label: "Day" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
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


export const loadProfileColumns: TableColumn[] = [
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "ctRatio", label: "CT Ratio", align: "end" },
  { key: "currentDate", label: "Current Date" },
  { key: "collectionDate", label: "Collection Date" },
  { key: "headline", label: "Headline" },
  { key: "value", label: "Value", align: "end" },
  { key: "data", label: "Data" },
  { key: "unit", label: "Unit" },
  { key: "status", label: "Status" },
  { key: "stationId", label: "Station Id" },
  { key: "createTime", label: "Create Time" },
  { key: "updateTime", label: "Update Time" },
];

export const eventNotificationColumns: TableColumn[] = [
  { key: "id", label: "Id", searchable: true },
  { key: "eventCode", label: "Event Code", searchable: true },
  { key: "eventType", label: "Event Type" },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "description", label: "Description" },
  { key: "remark", label: "Remark" },
  { key: "severity", label: "Severity" },
  { key: "stationId", label: "Station Id" },
  { key: "createTime", label: "Create Time" },
  { key: "updateTime", label: "Update Time" },
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
  { key: "receiptId", label: "Receipt Id", searchable: true },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterType", label: "Meter Type" },
  { key: "stationId", label: "Station Id" },
  { key: "testToken", label: "Test Token" },
  { key: "createTime", label: "Create Time" },
  { key: "status", label: "Status" },
  { key: "remark", label: "Remark" },
];

export const overdraftRecordColumns: TableColumn[] = [
  { key: "receiptId", label: "Receipt Id", searchable: true },
  { key: "customerId", label: "Customer Id", searchable: true },
  { key: "customerName", label: "Customer Name", searchable: true },
  { key: "meterId", label: "Meter Id", searchable: true },
  { key: "meterType", label: "Meter Type" },
  { key: "maximumOverdraftLimit", label: "Max Overdraft Limit", align: "end" },
  { key: "status", label: "Status" },
  { key: "createTime", label: "Create Time" },
  { key: "remark", label: "Remark" },
  { key: "stationId", label: "Station Id" },
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
  field("taskName", "Name", "Task name"),
  {
    ...field("scheduleDate", "Schedule Date", "Schedule date", "date"),
    helpText: "Leave empty to dispatch immediately.",
  },
  field("dataPrefix", "Data Prefix", "DLT645 flag / prefix"),
  field("remark", "Remark", "Operator remark"),
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
  field("data", "Data", "Raw task data"),
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
  field("data", "Data", "Raw task data"),
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
  field("data", "Data", "Raw task data"),
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
  field("customerId", "Customer Id", "Customer id"),
  field("customerName", "Customer Name", "Customer name"),
  field("type", "Type", "Customer type"),
  field("phone", "Phone", "Phone number"),
  field("address", "Address", "Address"),
  field("certifiName", "Certifi Name", "Certificate name"),
  field("certifiNo", "Certifi No", "Certificate number"),
  field("remark", "Remark", "Optional note"),
  field("stationId", "Station Id", "Station id"),
];

export const accountManagementFields = [
  field("customerId", "Customer Id", "Customer id"),
  field("meterId", "Meter Id", "Meter id"),
  field("oldMeterId", "Old Meter Id", "Required when replacing an existing meter"),
  field("ctRatio", "CT Ratio", "Current transformer ratio", "number"),
  field("tariffId", "Tariff Id", "Tariff id"),
  field("remark", "Remark", "Optional note"),
  field("stationId", "Station Id", "Station id"),
];

export const tariffManagementFields = [
  field("tariffId", "Tariff Id", "Tariff id"),
  field("tariffName", "Tariff Name", "Tariff name"),
  field("price", "Price", "Tariff price", "number"),
  field("tax", "Tax", "Tax amount or percentage", "number"),
  field("stationId", "Station Id", "Station id"),
  field("remark", "Remark", "Optional note"),
];

export const gatewayManagementFields = [
  field("gatewayId", "Gateway Id", "Gateway id"),
  field("gatewayName", "Gateway Name", "Gateway name"),
  field("stationId", "Station Id", "Station id"),
  field("remark", "Remark", "Optional note"),
];

export const meterManagementFields = [
  field("meterId", "Meter Id", "Meter id"),
  field("type", "Type", "Meter type"),
  selectField("isThreePhase", "Three Phase", "Select phase mode", [
    { label: "Single Phase", value: "false" },
    { label: "Three Phase", value: "true" },
  ]),
  field("communicationWay", "Communication Way", "Communication way"),
  field("protocolVersion", "Protocol Version", "Protocol version"),
  field("lat", "Latitude", "Latitude", "number"),
  field("lng", "Longitude", "Longitude", "number"),
  field("stationId", "Station Id", "Station id"),
  field("remark", "Remark", "Optional note"),
];

export const debtManagementFields = [
  field("customerId", "Customer Id", "Customer id"),
  field("customerName", "Customer Name", "Customer name"),
  field("meterId", "Meter Id", "Meter id"),
  field("totalDebt", "Total Debt", "Debt amount", "number"),
  field("status", "Status", "Status"),
  field("remark", "Remark", "Optional note"),
  field("stationId", "Station Id", "Station id"),
];

export const stationManagementFields = [
  field("stationId", "Station Id", "Station id"),
  field("stationName", "Station Name", "Station name"),
  field("name", "Name", "Display name"),
  field("address", "Address", "Station address"),
  field("lat", "Latitude", "Latitude", "number"),
  field("lng", "Longitude", "Longitude", "number"),
  field("remark", "Remark", "Optional note"),
];

export const roleManagementFields = [
  field("roleId", "Role Id", "Role id"),
  field("roleName", "Role Name", "Role name"),
  field("name", "Name", "Display name"),
  field("description", "Description", "Role description", "textarea"),
  field("remark", "Remark", "Optional note"),
];

export const userAdminFields = [
  field("userId", "User Id", "User id"),
  field("username", "Username", "Login username"),
  field("name", "Name", "Display name"),
  field("password", "Password", "Initial or reset password"),
  field("roleId", "Role Id", "Role id"),
  field("phone", "Phone", "Phone number"),
  field("email", "Email", "Email address"),
  field("stationId", "Station Id", "Station id"),
  field("remark", "Remark", "Optional note"),
];

export const updateFirmwareTaskFields: ActionField[] = [
  field("name", "Task Name", "Firmware task name"),
  field("meterId", "Meter Id", "Target meter id"),
  field("gatewayId", "Gateway Id", "Gateway id"),
  field("concentratorId", "Concentrator Id", "Concentrator id"),
  field("fileName", "File Name", "Firmware file name"),
  field("fileUrl", "File URL", "Uploaded firmware URL"),
  field("firmwareVersion", "Firmware Version", "Target firmware version"),
  field("stationId", "Station Id", "Station id"),
  field("remark", "Remark", "Deployment note"),
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
  const tokenInputFields: ActionField[] =
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

  const fields: ActionField[] = [
    ...tokenInputFields,
    {
      key: "authorizationPassword",
      label: "Authorization Password",
      type: "password",
      placeholder: "Enter authorization password",
      required: true,
      helpText: "Required by the upstream meter system before issuing tokens.",
    },
  ];

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
  insightPanels?: DataPageConfig["insightPanels"];
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
    insightPanels: options.insightPanels,
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
        label: `Create ${title} Task`,
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
  insightPanels?: DataPageConfig["insightPanels"];
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
    insightPanels: options.insightPanels,
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
