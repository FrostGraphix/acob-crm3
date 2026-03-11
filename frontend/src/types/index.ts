import type {
  ActionResponse as SharedActionResponse,
  AmrResponse,
  AuthUser,
} from "../../../common/types";

export type DataRow = Record<string, string | number | boolean | null>;
export type Envelope<T> = AmrResponse<T>;
export type { AuthUser };

export interface DashboardPanel {
  label: string;
  value: string;
  accent: "teal" | "blue" | "green" | "orange";
}

export interface SeriesData {
  labels: string[];
  values: number[];
}

export interface PieSlice {
  label: string;
  value: number;
}

export interface DashboardData {
  panels: DashboardPanel[];
  purchaseMoney: SeriesData;
  successRate: SeriesData;
  alarms: PieSlice[];
  consumption: {
    labels: string[];
    daily: number[];
    monthly: number[];
  };
}

export interface ApiDataResponse {
  rows: DataRow[];
  total: number;
}

export type ActionResponse = SharedActionResponse;

export interface TableColumn {
  key: string;
  label: string;
  align?: "start" | "center" | "end";
  searchable?: boolean;
}

export interface FilterField {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "date" | "number";
}

export interface ActionField {
  key: string;
  label: string;
  type?: "text" | "date" | "number" | "textarea";
  placeholder: string;
  sourceKey?: string;
}

export type ActionOperationKind =
  | "token-generate"
  | "task-create"
  | "task-update"
  | "management-create"
  | "management-import"
  | "management-update"
  | "management-delete"
  | "bulk-delete"
  | "record-cancel"
  | "report-export"
  | "client-export"
  | "client-print"
  | "generic";

export interface ActionConfig {
  key: string;
  label: string;
  endpoint: string;
  tone?: "primary" | "neutral" | "danger";
  operationKind?: ActionOperationKind;
  fields?: ActionField[];
  confirmMessage?: string;
}

export type ReadOperationKind = "table-read" | "report-read" | "task-read";

export interface BasePageConfig {
  kind: "dashboard" | "data" | "profile";
  path: string;
  title: string;
  menuLabel: string;
  description: string;
  sectionKey: string;
  includeInNavigation?: boolean;
}

export interface DashboardPageConfig extends BasePageConfig {
  kind: "dashboard";
}

export interface DataPageConfig extends BasePageConfig {
  kind: "data";
  readEndpoint: string;
  readOperationKind?: ReadOperationKind;
  columns: TableColumn[];
  filters: FilterField[];
  toolbarActions?: ActionConfig[];
  rowActions?: ActionConfig[];
  bulkActions?: ActionConfig[];
  showQuota?: boolean;
}

export interface ProfilePageConfig extends BasePageConfig {
  kind: "profile";
}

export type AppPageConfig = DashboardPageConfig | DataPageConfig | ProfilePageConfig;

export type SidebarIconKey =
  | "dashboard"
  | "token-generate"
  | "token-record"
  | "remote-operation"
  | "remote-operation-task"
  | "data-report"
  | "management";

export interface NavigationSection {
  key: string;
  label: string;
  iconKey: SidebarIconKey;
  items: AppPageConfig[];
}
