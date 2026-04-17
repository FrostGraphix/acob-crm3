export interface AmrResponse<T> {
  code: number;
  reason: string;
  result: T;
  meta?: {
    traceId?: string;
    serverTime?: string;
    policyDecision?: "allowed" | "denied";
  };
}

export interface AmrRequest<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  pageNumber?: number;
  pageSize?: number;
  searchTerm?: string;
  payload?: TPayload;
}

export interface AuthUser {
  id?: string;
  username: string;
  displayName: string;
  role: string;
  appRole?: string;
  siteCode?: string | null;
  vendorId?: string | null;
  forcePasswordChange?: boolean;
  permissions?: string[];
  email?: string;
  phone?: string;
  address?: string;
  remark?: string;
}

export interface AuthSessionToken {
  user: AuthUser;
  sessionId: string;
  issuedAt: number;
}

export type VendorStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "active"
  | "suspended"
  | "closed"
  | "rejected";

export type WalletStatus = "pending" | "active" | "frozen" | "suspended" | "closed";
export type WalletFundingStatus =
  | "initiated"
  | "awaiting_proof"
  | "proof_uploaded"
  | "under_review"
  | "confirmed"
  | "posted"
  | "rejected"
  | "expired"
  | "cancelled";
export type WalletPurchaseDeliveryMethod = "remote_send" | "token_generate";
export type WalletPurchaseStatus =
  | "pending"
  | "reserved"
  | "processing"
  | "successful"
  | "failed"
  | "reversed"
  | "manual_review";
export type WalletExceptionSeverity = "low" | "medium" | "high" | "critical";
export type WalletJournalStatus = "draft" | "posted" | "reversed";
export type WalletEntrySide = "debit" | "credit";

export interface VendorOrganizationRecord {
  id: string;
  vendorCode: string;
  legalName: string;
  displayName: string;
  status: VendorStatus;
  siteCode: string | null;
  kycStatus: string | null;
  riskRating: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VendorWalletRecord {
  id: string;
  vendorId: string;
  walletNumber: string;
  currencyCode: string;
  status: WalletStatus;
  availableBalance: number;
  reservedBalance: number;
  allowCredit: boolean;
  siteCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WalletReceiptRecord {
  id: string;
  purchaseOrderId: string;
  vendorId: string;
  siteCode: string;
  deliveryMethod: WalletPurchaseDeliveryMethod;
  meterSn: string;
  customerRef: string | null;
  amount: number;
  tokenValue: string | null;
  remoteSendRef: string | null;
  receiptNumber: string;
  issuedAt: string;
  issuedBy: string;
}

export interface WalletFundingRequestPayload {
  walletId: string;
  amount: number;
  channel: "bank_transfer" | "cash_branch" | "cash_at_branch" | "payment_gateway" | "internal_transfer";
  proofDocumentId?: string;
  idempotencyKey?: string;
}

export interface WalletPurchaseRequestPayload {
  idempotencyKey: string;
  walletId: string;
  meterSn: string;
  customerRef: string;
  amount: number;
  siteCode: string;
}

export interface WalletPurchaseResponse {
  purchaseId: string;
  walletId: string;
  status: WalletPurchaseStatus;
  deliveryMethod: WalletPurchaseDeliveryMethod;
  receiptId: string | null;
  receiptNumber: string | null;
  tokenValue?: string | null;
  remoteSendRef?: string | null;
  message: string;
}

export interface WalletSummaryResponse {
  wallet: VendorWalletRecord;
  todayPurchaseCount: number;
  todayPurchaseAmount: number;
  recentReceipts: WalletReceiptRecord[];
}

export interface ApiRowsResponse<TRow extends Record<string, unknown>> {
  rows: TRow[];
  total: number;
}

export interface ActionResponse {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

export type TheftSignalSeverity = "watch" | "suspect" | "critical";
export type TheftCaseStatus =
  | "new"
  | "active"
  | "investigating"
  | "confirmed-theft"
  | "false-positive"
  | "closed";

export interface TheftSignalRecord {
  id: string;
  meterId: string;
  customerName?: string;
  siteId?: string;
  severity: TheftSignalSeverity;
  score: number;
  signalTypes: string[];
  title: string;
  message: string;
  status: "active" | "resolved";
  createdAt: string;
  updatedAt: string;
}

export interface TheftCaseRecord {
  id: string;
  meterId: string;
  customerName?: string;
  siteId?: string;
  severity: TheftSignalSeverity;
  score: number;
  status: TheftCaseStatus;
  signalIds: string[];
  owner?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export type RemoteTaskType =
  | "reading"
  | "setting"
  | "control"
  | "token"
  | "transparent-forwarding";

export type RemoteTaskRiskLevel = "low" | "medium" | "high";

export interface RemoteMeterTarget {
  meterId: string;
  customerId?: string;
  customerName?: string;
  meterType?: string;
  stationId?: string;
  gatewayId?: string;
  protocolVersion?: string;
}

export interface RemoteTaskBaseRequest {
  taskType: RemoteTaskType;
  taskName?: string;
  scheduleDate?: string;
  target: RemoteMeterTarget;
}

export interface CreateReadingTaskRequest extends RemoteTaskBaseRequest {
  taskType: "reading";
  dataItem: string;
  readMode?: "single" | "profile" | "instant";
}

export interface CreateSettingTaskRequest extends RemoteTaskBaseRequest {
  taskType: "setting";
  settingKey: string;
  settingValue: string;
  valueType?: "string" | "number" | "hex" | "json";
}

export interface CreateControlTaskRequest extends RemoteTaskBaseRequest {
  taskType: "control";
  controlCommand: "connect" | "disconnect" | "open" | "close";
  reason?: string;
}

export interface CreateTokenTaskRequest extends RemoteTaskBaseRequest {
  taskType: "token";
  tokenType: "credit" | "clear-credit" | "clear-tamper" | "change-key" | "custom";
  tokenValue?: string;
}

export interface CreateTransparentForwardingTaskRequest extends RemoteTaskBaseRequest {
  taskType: "transparent-forwarding";
  protocolMode: "hex" | "ascii";
  commandPayload: string;
  timeoutSeconds?: number;
}

export type RemoteTaskCreateRequest =
  | CreateReadingTaskRequest
  | CreateSettingTaskRequest
  | CreateControlTaskRequest
  | CreateTokenTaskRequest
  | CreateTransparentForwardingTaskRequest;

export type RemoteTaskStatus =
  | "pending"
  | "queued"
  | "running"
  | "success"
  | "failed"
  | "cancelled"
  | "unknown";

export interface RemoteTaskCreateResponse {
  accepted: boolean;
  taskId?: string;
  message?: string;
}

export type AnalyticsMixTone = "info" | "success" | "warning" | "danger";
export type AnalyticsMixChartType = "line" | "bar";
export type AnalyticsMixCellValue = string | number | boolean | null;

export interface AnalyticsMixSummaryItem {
  key: string;
  label: string;
  value: AnalyticsMixCellValue;
  tone?: AnalyticsMixTone;
  helper?: string;
  unit?: string;
}

export interface AnalyticsMixChartSeries {
  key: string;
  label: string;
  values: number[];
  type?: AnalyticsMixChartType;
  color?: string;
}

export interface AnalyticsMixChart {
  labels: string[];
  series: AnalyticsMixChartSeries[];
}

export interface AnalyticsMixTableColumn {
  key: string;
  label: string;
  align?: "start" | "center" | "end";
}

export interface AnalyticsMixTableRow {
  [key: string]: AnalyticsMixCellValue;
}

export interface AnalyticsMixResponse<
  TRow extends AnalyticsMixTableRow = AnalyticsMixTableRow,
> {
  mixKey: string;
  title: string;
  description: string;
  summary: AnalyticsMixSummaryItem[];
  chart?: AnalyticsMixChart | null;
  columns: AnalyticsMixTableColumn[];
  rows: TRow[];
  metadata?: Record<string, AnalyticsMixCellValue>;
}

export interface DashboardRiskOverlayResponse extends AnalyticsMixResponse {
  mixKey: "dashboard-risk-overlay";
}

export interface DashboardRevenueVsUsageResponse extends AnalyticsMixResponse {
  mixKey: "dashboard-revenue-vs-usage";
}

export interface DashboardPortfolioHealthResponse extends AnalyticsMixResponse {
  mixKey: "dashboard-portfolio-health";
}

export interface SiteBenchmarkMatrixResponse extends AnalyticsMixResponse {
  mixKey: "site-benchmark-matrix";
}

export interface TopConsumerWatchlistResponse extends AnalyticsMixResponse {
  mixKey: "top-consumer-watchlist";
}

export interface Customer360LiteResponse extends AnalyticsMixResponse {
  mixKey: "customer-360-lite";
}

export interface MeterPerformanceSheetResponse extends AnalyticsMixResponse {
  mixKey: "meter-performance-sheet";
}

export interface TokenReconciliationResponse extends AnalyticsMixResponse {
  mixKey: "token-reconciliation";
}

export interface CollectionsPriorityResponse extends AnalyticsMixResponse {
  mixKey: "collections-priority";
}

export interface TheftPrioritizationResponse extends AnalyticsMixResponse {
  mixKey: "theft-prioritization";
}

export interface SiteLossExposureResponse extends AnalyticsMixResponse {
  mixKey: "site-loss-exposure";
}

export interface NotificationsCorrelatedFeedResponse extends AnalyticsMixResponse {
  mixKey: "notifications-correlated-feed";
}

export interface MasterDataConsistencyResponse extends AnalyticsMixResponse {
  mixKey: "master-data-consistency";
}

export interface DataEngineCatalogEntry {
  key: string;
  name: string;
  category:
    | "revenue"
    | "consumption"
    | "risk"
    | "monitoring"
    | "operations"
    | "warehouse"
    | "forecasting";
  status: "implemented" | "partial" | "planned";
  endpointNames: string[];
  inputApis: string[];
  formulas: string[];
  supabaseTables: string[];
  refreshInterval: string;
  workerSchedule: string;
  backendServices: string[];
  frontendPages: string[];
}

export interface DataEngineCatalogResponse {
  generatedAt: string;
  entries: DataEngineCatalogEntry[];
}

export interface CustomerConsumptionRechargeSummaryRow {
  customerId: string | null;
  customerName: string;
  accountNo: string | null;
  meterId: string;
  site: string | null;
  totalRechargeAmount: number;
  totalRechargeKwh: number;
  totalConsumptionKwh: number;
  rechargeCount: number;
  lastRechargeAt: string | null;
  varianceKwh: number;
}

export interface CustomerConsumptionRechargeSummaryResponse {
  summary: {
    customers: number;
    totalRechargeAmount: number;
    totalRechargeKwh: number;
    totalConsumptionKwh: number;
  };
  rows: CustomerConsumptionRechargeSummaryRow[];
}

export interface CustomerConsumptionRechargeDailyRow {
  date: string;
  meterId: string;
  customerName: string;
  rechargeAmount: number;
  rechargeKwh: number;
  consumptionKwh: number;
  varianceKwh: number;
}

export interface CustomerConsumptionRechargeDailyResponse {
  summary: {
    totalRechargeAmount: number;
    totalRechargeKwh: number;
    totalConsumptionKwh: number;
    totalVarianceKwh: number;
  };
  rows: CustomerConsumptionRechargeDailyRow[];
}

export interface CustomerLiveDailyConsumptionResponse {
  meterId: string;
  customerName: string | null;
  site: string | null;
  date: string;
  todayRechargeAmount: number;
  todayRechargeKwh: number;
  todayConsumptionKwh: number;
  varianceKwh: number;
  lastUpdatedAt: string;
}

export interface CustomerSegmentRow {
  meterId: string;
  customerName: string;
  accountNo: string | null;
  site: string | null;
  segment: string;
  rechargeCount30d: number;
  totalRechargeAmount30d: number;
  avgDailyConsumption7d: number;
}

export interface CustomerSegmentsResponse {
  generatedAt: string;
  rows: CustomerSegmentRow[];
}

export interface CustomerForecastRow {
  meterId: string;
  customerName: string;
  site: string | null;
  avgDailyConsumption7d: number;
  avgRechargeKwh30d: number;
  estimatedDaysCovered: number;
  predictedNextRechargeDate: string | null;
}

export interface CustomerForecastsResponse {
  generatedAt: string;
  rows: CustomerForecastRow[];
}

export interface RevenueLeakageRow {
  meterId: string;
  customerName: string;
  site: string | null;
  leakageScore: number;
  estimatedLossKwh: number;
  reasons: string[];
}

export interface RevenueLeakageResponse {
  generatedAt: string;
  rows: RevenueLeakageRow[];
}

export interface OperationalPriorityRow {
  meterId: string;
  customerName: string;
  site: string | null;
  priorityScore: number;
  recommendedAction: string;
  reasons: string[];
}

export interface OperationalPriorityResponse {
  generatedAt: string;
  rows: OperationalPriorityRow[];
}
