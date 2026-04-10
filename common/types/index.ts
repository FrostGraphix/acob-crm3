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
  username: string;
  displayName: string;
  role: string;
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
