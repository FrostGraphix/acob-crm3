import type {
  ActionResponse as SharedActionResponse,
  AmrResponse,
  AuthUser,
  RemoteTaskRiskLevel,
  RemoteTaskType,
} from "../../../common/types";

export type DataRow = Record<string, string | number | boolean | null>;
export type Envelope<T> = AmrResponse<T>;
export type { AuthUser };
export type { RemoteTaskRiskLevel, RemoteTaskType };

export interface DashboardPanel {
  label: string;
  value: string;
  accent: "teal" | "blue" | "green" | "orange";
  unit?: string;
  icon: "accounts" | "refresh" | "energy" | "revenue";
}

export interface SeriesData {
  labels: string[];
  values: number[];
}

export interface PieSlice {
  label: string;
  value: number;
}

export interface DashboardQueryWindow {
  from: string;
  to: string;
}

export interface DashboardSiteOption {
  value: string;
  label: string;
}

export interface ReportChartData {
  labels: string[];
  values: number[];
  type: "line" | "bar";
  averageValue?: number;
  seriesName: string;
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
  portfolioLabel: string;
  selectedSiteId: string | null;
  selectedSiteLabel: string;
  sourceWindow: DashboardQueryWindow | null;
  lastUpdatedAt: string | null;
  livePulse: Array<{
    timeLabel: string;
    message: string;
  }>;
}

export interface EngineLeaderStatus {
  coordinationMode: "redis" | "single-instance";
  isLeader: boolean;
  leaseKey: string;
  instanceId: string;
  lastLeadershipChangeAt: string | null;
  lastLeadershipError: string | null;
}

export interface RuntimeEngineStatus {
  name: string;
  enabledByConfig: boolean;
  schedulerRunning: boolean;
  leader: EngineLeaderStatus;
  lastRunStartedAt: string | null;
  lastRunCompletedAt: string | null;
  lastRunDurationMs: number | null;
  lastError: string | null;
  sourceWindow?: {
    fromDate: string;
    toDate: string;
  };
  theftMetrics?: {
    activeSignals: number;
    openCases: number;
    criticalSignals: number;
  };
}

export interface RuntimeEngineCollection {
  analysis: RuntimeEngineStatus;
  siteConsumption: RuntimeEngineStatus;
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

export type ReportDisplayMode = "table" | "analytics";
export type ReportAnalyticsKey = "site-consumption" | "consumption-statistics";

export interface ActionField {
  key: string;
  label: string;
  type?: "text" | "date" | "number" | "textarea" | "select";
  placeholder: string;
  sourceKey?: string;
  required?: boolean;
  helpText?: string;
  options?: Array<{ label: string; value: string }>;
}

export type ActionOperationKind =
  | "token-generate"
  | "token-generate-credit"
  | "token-generate-limit"
  | "token-generate-basic"
  | "task-create"
  | "task-update"
  | "drilldown"
  | "theft-case-create"
  | "management-create"
  | "management-import"
  | "management-update"
  | "management-delete"
  | "bulk-delete"
  | "record-cancel"
  | "report-export"
  | "client-export"
  | "client-print"
  | "file-upload"
  | "generic";

export interface ActionConfig {
  key: string;
  label: string;
  endpoint: string;
  tone?: "primary" | "neutral" | "danger";
  operationKind?: ActionOperationKind;
  fields?: ActionField[];
  confirmMessage?: string;
  remoteTaskType?: RemoteTaskType;
  dangerLevel?: RemoteTaskRiskLevel;
  requiresReviewStep?: boolean;
  payloadBuilderKey?:
    | "reading"
    | "setting"
    | "control"
    | "token"
    | "transparent-forwarding";
  successRedirectPath?: string;
  requiresReason?: boolean;
  riskLevel?: "low" | "medium" | "high";
}

export type ReadOperationKind = "table-read" | "report-read" | "task-read";

export interface BasePageConfig {
  kind: "dashboard" | "data" | "profile" | "runtime-admin";
  path: string;
  title: string;
  menuLabel: string;
  description: string;
  sectionKey: string;
  includeInNavigation?: boolean;
  requiredRole?: string;
  requiredPermissions?: string[];
}

export interface DashboardPageConfig extends BasePageConfig {
  kind: "dashboard";
}

export interface DataPageConfig extends BasePageConfig {
  kind: "data";
  readEndpoint: string;
  readMethod?: "GET" | "POST";
  readOperationKind?: ReadOperationKind;
  columns: TableColumn[];
  filters: FilterField[];
  meterDrilldown?: {
    primaryEndpoint: string;
    fallbackEndpoint: string;
    refreshMs: number;
  };
  reportDisplayMode?: ReportDisplayMode;
  reportAnalyticsKey?: ReportAnalyticsKey;
  requiredReadFilters?: string[];
  omitReadPaging?: boolean;
  requestDateFormat?: "iso" | "day-first";
  toolbarActions?: ActionConfig[];
  rowActions?: ActionConfig[];
  bulkActions?: ActionConfig[];
  showQuota?: boolean;
  live?: {
    enabled: boolean;
    intervalMs: number;
    pauseOnHidden: boolean;
    critical?: boolean;
  };
  riskIntegration?: {
    canOpenCase?: boolean;
    riskSignals?: string[];
  };
  actionPolicy?: {
    guardedConfirm?: boolean;
    requireReasonForHighRisk?: boolean;
  };
}

export interface ProfilePageConfig extends BasePageConfig {
  kind: "profile";
}

export interface RuntimeAdminPageConfig extends BasePageConfig {
  kind: "runtime-admin";
}

export type AppPageConfig =
  | DashboardPageConfig
  | DataPageConfig
  | ProfilePageConfig
  | RuntimeAdminPageConfig;

export type SidebarIconKey =
  | "dashboard"
  | "token-generate"
  | "token-record"
  | "remote-operation"
  | "remote-operation-task"
  | "data-report"
  | "management"
  | "meter"
  | "debt"
  | "protocol"
  | "runtime-ops"
  | "load-profile"
  | "log"
  | "event"
  | "file-upload";

export interface NavigationSection {
  key: string;
  label: string;
  iconKey: SidebarIconKey;
  items: AppPageConfig[];
}
