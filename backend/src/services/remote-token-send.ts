import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { env } from "./env.js";
import { insertAuditLog, insertRemoteTask, isSupabaseDbEnabled } from "./supabase-db.js";
import { extractUpstreamPermissions, hasUpstreamPermission } from "./upstream-permissions.js";
import { buildUpstreamRequestPlan } from "./upstream-request-adapters.js";
import { forwardWithUpstreamSessionRecovery } from "./upstream-session.js";
import { forwardToUpstream, loginToUpstream, type UpstreamResult } from "./upstream.js";

type RemoteTokenOperation = "send-credit" | "clear-credit";
type RemoteTokenLoadMode = "naira" | "unit";

interface RemoteTokenSendInput {
  row?: Record<string, unknown>;
  operation: RemoteTokenOperation;
  loadMode?: RemoteTokenLoadMode;
  amount?: number;
  taskName?: string;
  scheduleDate?: string;
  operatorReason?: string;
}

interface CreditResolution {
  amount: number;
  unit: number;
  source: string;
}

interface RemoteAttemptFailure {
  label: string;
  statusCode: number;
  reason: string;
}

interface ForwardCandidatesResult {
  result: UpstreamResult;
  successfulLabel: string | null;
  failures: RemoteAttemptFailure[];
}

interface DirectSendCredential {
  username?: string;
  password?: string;
  token?: string;
  source: "station-config" | "gprs-service-token";
}

const GPRS_TOKEN_TASK_PERMISSION = "GPRSMeterTask.GPRSCreateTokenTask";

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function readNumber(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeStationId(value: string | null) {
  return value ? value.trim().toUpperCase() : null;
}

function resolveProtocolId(row: Record<string, unknown>) {
  const directProtocolId = readNumber(row, ["protocolId", "ProtocolId"]);
  if (directProtocolId !== null && Number.isFinite(directProtocolId)) {
    return directProtocolId;
  }

  const protocolVersion = readString(row, ["protocolVersion", "ProtocolVersion"]);
  if (protocolVersion === "2.2") {
    return 22;
  }

  if (protocolVersion === "2.0") {
    return 20;
  }

  return 0;
}

function looksLikeDirectGprsMeter(row: Record<string, unknown>) {
  const protocolVersion = readString(row, ["protocolVersion", "ProtocolVersion"]);
  const communicationWay = readNumber(row, ["communicationWay", "CommunicationWay"]);

  return (
    protocolVersion === "2.2" ||
    protocolVersion === "2.0" ||
    communicationWay === 1
  );
}

function resolveDirectSendCredential(stationId: string | null): DirectSendCredential | null {
  const gprsServiceToken = env.gprsUpstreamBearerToken.trim() || env.upstreamBearerToken.trim();
  if (gprsServiceToken.length > 0) {
    return {
      token: gprsServiceToken,
      source: "gprs-service-token",
    };
  }

  const normalized = normalizeStationId(stationId);
  if (!normalized) {
    return null;
  }

  const directAccount = env.directSendUpstreamAccounts[normalized];
  if (!directAccount) {
    return null;
  }

  return {
    username: directAccount.username,
    password: directAccount.password,
    source: "station-config",
  };
}

function maskTokenValue(tokenValue: string | null) {
  if (!tokenValue) {
    return null;
  }

  const compact = tokenValue.replace(/\s+/g, "");
  if (compact.length <= 6) {
    return "***";
  }

  return `${compact.slice(0, 2)}***${compact.slice(-4)}`;
}

function extractRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result.map((entry) => asRecord(entry));
  }

  const root = asRecord(result);
  for (const key of ["rows", "data", "list", "records", "items"]) {
    if (Array.isArray(root[key])) {
      return (root[key] as unknown[]).map((entry) => asRecord(entry));
    }
  }

  const nested = root.result;
  if (nested !== undefined) {
    return extractRows(nested);
  }

  return [];
}

function extractTokenValue(result: unknown): string | null {
  const queue: unknown[] = [result];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || current === null || seen.has(current)) {
      continue;
    }

    seen.add(current);

    if (typeof current === "string") {
      const compact = current.replace(/\s+/g, "");
      if (/^\d{8,}$/.test(compact)) {
        return compact;
      }
      continue;
    }

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (typeof current === "object") {
      const record = current as Record<string, unknown>;

      for (const key of ["token", "tokenValue", "tokenRecharge", "stsToken", "data"]) {
        const candidate = record[key];
        if (typeof candidate === "string") {
          const compact = candidate.replace(/\s+/g, "");
          if (/^\d{8,}$/.test(compact)) {
            return compact;
          }
        }
      }

      queue.push(...Object.values(record));
    }
  }

  return null;
}

async function forwardCandidates(
  request: AuthenticatedRequest,
  response: Response,
  pathname: string,
  candidates: Array<{ label: string; body: unknown }>,
): Promise<ForwardCandidatesResult> {
  const failures: RemoteAttemptFailure[] = [];

  const result = await forwardWithUpstreamSessionRecovery(request, response, async (upstreamCookie) => {
    let lastResult: UpstreamResult = {
      statusCode: 500,
      payload: {
        code: 1,
        reason: "No upstream candidate bodies provided",
        result: null,
      },
    };

    for (const candidate of candidates) {
      lastResult = await forwardToUpstream(
        pathname,
        candidate.body as Record<string, unknown>,
        upstreamCookie,
      );

      if (lastResult.statusCode < 400 && lastResult.payload.code === 0) {
        (lastResult as ForwardCandidatesResult["result"] & { __candidateLabel?: string }).__candidateLabel = candidate.label;
        return lastResult;
      }

      failures.push({
        label: candidate.label,
        statusCode: lastResult.statusCode,
        reason: lastResult.payload.reason || "Upstream request failed",
      });
    }

    return lastResult;
  });

  const successfulLabel =
    typeof (result as ForwardCandidatesResult["result"] & { __candidateLabel?: string }).__candidateLabel === "string"
      ? (result as ForwardCandidatesResult["result"] & { __candidateLabel?: string }).__candidateLabel ?? null
      : null;

  return {
    result,
    successfulLabel,
    failures,
  };
}

async function forwardCandidatesWithAuthToken(
  pathname: string,
  authToken: string,
  candidates: Array<{ label: string; body: unknown }>,
): Promise<ForwardCandidatesResult> {
  const failures: RemoteAttemptFailure[] = [];
  let lastResult: UpstreamResult = {
    statusCode: 500,
    payload: {
      code: 1,
      reason: "No upstream candidate bodies provided",
      result: null,
    },
  };

  for (const candidate of candidates) {
    lastResult = await forwardToUpstream(
      pathname,
      candidate.body as Record<string, unknown>,
      authToken,
    );

    if (lastResult.statusCode < 400 && lastResult.payload.code === 0) {
      return {
        result: lastResult,
        successfulLabel: candidate.label,
        failures,
      };
    }

    failures.push({
      label: candidate.label,
      statusCode: lastResult.statusCode,
      reason: lastResult.payload.reason || "Upstream request failed",
    });
  }

  return {
    result: lastResult,
    successfulLabel: null,
    failures,
  };
}

async function readTariffRateFromUpstream(
  request: AuthenticatedRequest,
  response: Response,
  tariffId: string,
) {
  const plan = buildUpstreamRequestPlan("/api/tariff/read", {
    pageNumber: 1,
    pageSize: 10,
    id: tariffId,
    tariffId,
    searchTerm: tariffId,
  });
  const candidates = plan.candidateBodies.map((body, index) => ({
    label: `tariff-${index + 1}`,
    body,
  }));

  const forwarded = await forwardCandidates(request, response, "/api/tariff/read", candidates);
  if (forwarded.result.statusCode >= 400 || forwarded.result.payload.code !== 0) {
    return null;
  }

  const rows = extractRows(forwarded.result.payload.result);
  for (const row of rows) {
    const rowTariffId = readString(row, ["id", "tariffId", "TariffId", "tariff"]);
    if (rowTariffId && rowTariffId !== tariffId) {
      continue;
    }

    const rate = readNumber(row, ["price", "unitPrice", "tariffPrice", "priceValue"]);
    if (rate !== null && rate > 0) {
      return rate;
    }
  }

  return null;
}

async function readRecentVendRate(
  request: AuthenticatedRequest,
  response: Response,
  meterId: string,
) {
  const plan = buildUpstreamRequestPlan("/api/token/creditTokenRecord/readMore", {
    pageNumber: 1,
    pageSize: 10,
    meterId,
    searchTerm: meterId,
  });
  const candidates = plan.candidateBodies.map((body, index) => ({
    label: `history-${index + 1}`,
    body,
  }));

  const forwarded = await forwardCandidates(
    request,
    response,
    "/api/token/creditTokenRecord/readMore",
    candidates,
  );
  if (forwarded.result.statusCode >= 400 || forwarded.result.payload.code !== 0) {
    return null;
  }

  const rows = extractRows(forwarded.result.payload.result);
  for (const row of rows) {
    const amount = readNumber(row, ["totalPaid", "Amount", "amount", "totalPrice"]);
    const unit = readNumber(row, ["totalUnit", "TransactionKwh", "transactionKwh", "kwh"]);
    if (amount !== null && unit !== null && amount > 0 && unit > 0) {
      return roundToTwo(amount / unit);
    }
  }

  return null;
}

async function resolveCreditValues(
  request: AuthenticatedRequest,
  response: Response,
  row: Record<string, unknown>,
  loadMode: RemoteTokenLoadMode,
  amountInput: number,
): Promise<CreditResolution> {
  const directRate = readNumber(row, ["price", "unitPrice", "tariffPrice", "priceValue"]);
  let nairaPerUnit = directRate !== null && directRate > 0 ? directRate : null;
  let source = nairaPerUnit !== null ? "selected-meter" : "";

  if (nairaPerUnit === null) {
    const tariffId = readString(row, ["tariffId", "TariffId", "tariff"]);
    if (tariffId) {
      nairaPerUnit = await readTariffRateFromUpstream(request, response, tariffId);
      if (nairaPerUnit !== null) {
        source = "tariff-read";
      }
    }
  }

  if (nairaPerUnit === null) {
    const meterId = readString(row, ["meterId", "MeterId", "meterNo", "MeterNo"]);
    if (meterId) {
      nairaPerUnit = await readRecentVendRate(request, response, meterId);
      if (nairaPerUnit !== null) {
        source = "recent-vend-history";
      }
    }
  }

  if (nairaPerUnit === null || nairaPerUnit <= 0) {
    const meterId = readString(row, ["meterId", "MeterId", "meterNo", "MeterNo"]) ?? "selected meter";
    throw new Error(
      `Unable to resolve tariff rate for ${meterId}; remote token send is blocked to avoid incorrect unit delivery.`,
    );
  }

  if (loadMode === "naira") {
    return {
      amount: roundToTwo(amountInput),
      unit: roundToTwo(Math.max(amountInput / nairaPerUnit, 0.01)),
      source,
    };
  }

  return {
    amount: roundToTwo(Math.max(amountInput * nairaPerUnit, 0.01)),
    unit: roundToTwo(amountInput),
    source,
  };
}

function buildRemoteDeliveryCandidates(args: {
  meterId: string;
  customerId: string | null;
  customerName: string | null;
  stationId: string | null;
  tokenValue: string;
  tokenType: "credit" | "clear-credit";
  taskName?: string | null;
  scheduleDate?: string | null;
  operatorReason?: string | null;
}) {
  const compactToken = args.tokenValue.replace(/\s+/g, "");
  const scheduleDate = args.scheduleDate?.trim() || new Date().toISOString().slice(0, 10);
  const operationRemark =
    args.operatorReason?.trim() ||
    (args.tokenType === "clear-credit" ? "Clear credit token" : "Credit token");
  const taskLabel =
    args.taskName?.trim() ||
    (args.tokenType === "clear-credit" ? "Clear Credit Token" : "Send Credit Token");
  const common = {
    meterId: args.meterId,
    customerId: args.customerId ?? args.meterId,
    customerName: args.customerName ?? args.customerId ?? args.meterId,
    stationId: args.stationId ?? "",
    name: "Send Token",
    data: compactToken,
    dataPrefix: "",
    remark: operationRemark,
    scheduleDate,
  };

  const alias = {
    meterNo: common.meterId,
    customerNo: common.customerId,
    site: common.stationId,
    name: common.name,
    data: common.data,
    dataPrefix: common.dataPrefix,
    remark: common.remark,
    scheduleDate,
  };

  const canonicalTask = {
    taskType: "token",
    taskName: taskLabel,
    meterId: common.meterId,
    customerId: common.customerId,
    customerName: common.customerName,
    stationId: common.stationId,
    tokenType: args.tokenType,
    tokenValue: compactToken,
    reviewConfirmed: true,
    operatorReason: common.remark,
    Lang: "en",
    scheduleDate,
  };

  const aliasedTask = {
    taskType: "token",
    taskName: taskLabel,
    meterNo: common.meterId,
    customerNo: common.customerId,
    site: common.stationId,
    commandType: args.tokenType,
    token: compactToken,
    reviewConfirmed: true,
    operatorReason: common.remark,
    Lang: "en",
    scheduleDate,
  };

  const tokenVariants =
    args.tokenType === "clear-credit"
      ? ["clear-credit", "clearCredit", "clear-credit-token", "clearCreditToken"]
      : ["credit", "creditToken", "send-credit", "sendCredit"];

  return tokenVariants.flatMap((tokenVariant) => {
    const variantTask = {
      ...canonicalTask,
      tokenType: tokenVariant,
      taskName: taskLabel,
    };
    const variantAliasTask = {
      ...aliasedTask,
      commandType: tokenVariant,
      taskName: taskLabel,
      name: taskLabel,
    };
    const variantCommon = {
      ...common,
      taskName: taskLabel,
      tokenType: tokenVariant,
    };
    const variantAlias = {
      ...alias,
      taskName: taskLabel,
      commandType: tokenVariant,
      tokenType: tokenVariant,
    };

    return [
      { label: `array-send-token-${tokenVariant}`, body: [variantCommon] },
      { label: `array-send-token-alias-${tokenVariant}`, body: [variantAlias] },
      { label: `array-canonical-task-${tokenVariant}`, body: [variantTask] },
      { label: `array-aliased-task-${tokenVariant}`, body: [variantAliasTask] },
      { label: `object-send-token-${tokenVariant}`, body: variantCommon },
      { label: `object-send-token-alias-${tokenVariant}`, body: variantAlias },
      { label: `object-canonical-task-${tokenVariant}`, body: variantTask },
      { label: `object-aliased-task-${tokenVariant}`, body: variantAliasTask },
    ];
  });
}

function buildGprsDeliveryCandidates(args: {
  meterId: string;
  customerId: string | null;
  customerName: string | null;
  stationId: string | null;
  tokenValue: string;
  protocolId: number;
  taskName?: string | null;
  operatorReason?: string | null;
}) {
  const compactToken = args.tokenValue.replace(/\s+/g, "");
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const baseRow = {
    customerId: args.customerId ?? args.meterId,
    customerName: args.customerName ?? args.customerId ?? args.meterId,
    meterId: args.meterId,
    protocolId: args.protocolId,
    name: args.taskName?.trim() || "Send Token",
    data: compactToken,
    dataPrefix: "",
    stationId: args.stationId ?? "",
    remark: args.operatorReason?.trim() || null,
  };

  return [
    {
      label: "gprs-row-basic",
      body: [baseRow],
    },
    {
      label: "gprs-row-status",
      body: [
        {
          ...baseRow,
          status: 0,
        },
      ],
    },
    {
      label: "gprs-row-audit",
      body: [
        {
          ...baseRow,
          status: 0,
          createId: "ACOB",
          createDate: now,
          updateId: "ACOB",
          updateDate: now,
        },
      ],
    },
    {
      label: "gprs-alias-basic",
      body: [
        {
          meterNo: baseRow.meterId,
          customerNo: baseRow.customerId,
          customerName: baseRow.customerName,
          site: baseRow.stationId,
          name: baseRow.name,
          data: baseRow.data,
          dataPrefix: baseRow.dataPrefix,
          remark: baseRow.remark,
        },
      ],
    },
  ];
}

function buildGenerateAttempts(args: {
  row: Record<string, unknown>;
  operation: RemoteTokenOperation;
  meterId: string;
  amount?: number;
  unit?: number;
}) {
  const authorizationPassword = env.remoteSendAuthorizationPassword.trim();
  if (!authorizationPassword) {
    throw new Error("REMOTE_SEND_AUTHORIZATION_PASSWORD must be configured for remote token delivery.");
  }

  const basePasswordFields = {
    authorizationPassword,
    AuthorizationPassword: authorizationPassword,
    authPassword: authorizationPassword,
    password2: authorizationPassword,
  };

  if (args.operation === "send-credit") {
    const vendUnits = roundToTwo(Math.max(args.unit ?? args.amount ?? 0, 0.01));
    const vendAmount = roundToTwo(Math.max(args.amount ?? args.unit ?? 0, 0.01));
    const isS2 = readString(args.row, ["protocolVersion", "ProtocolVersion"] ) === "2.2";

    return {
      pathname: "/api/token/creditToken/generate",
      candidates: [
        {
          label: "schema-naira-primary",
          body: {
            meterId: args.meterId,
            isPreview: false,
            isVendByTotalPaid: true,
            amount: vendAmount,
            payDebtPercent: 0,
            isS2,
            ...basePasswordFields,
          },
        },
        {
          label: "schema-unit-primary",
          body: {
            meterId: args.meterId,
            isPreview: false,
            isVendByTotalPaid: false,
            amount: vendUnits,
            payDebtPercent: 0,
            isS2,
            unit: vendUnits,
            totalUnit: vendUnits,
            totalPaid: vendAmount,
            ...basePasswordFields,
          },
        },
        {
          label: "unit-primary",
          body: {
            row: args.row,
            amount: vendUnits,
            unit: vendUnits,
            totalUnit: vendUnits,
            totalPaid: vendAmount,
            price: vendAmount,
            ...basePasswordFields,
          },
        },
        {
          label: "money-primary",
          body: {
            row: args.row,
            amount: vendAmount,
            unit: vendUnits,
            totalUnit: vendUnits,
            totalPaid: vendAmount,
            price: vendAmount,
            ...basePasswordFields,
          },
        },
        {
          label: "unit-only",
          body: {
            row: args.row,
            amount: vendUnits,
            unit: vendUnits,
            ...basePasswordFields,
          },
        },
        {
          label: "money-unit",
          body: {
            row: args.row,
            amount: vendAmount,
            unit: vendUnits,
            ...basePasswordFields,
          },
        },
      ],
    };
  }

  return {
    pathname: "/api/token/clearCreditToken/generate",
    candidates: [
      {
        label: "clear-credit",
        body: {
          row: args.row,
          ...basePasswordFields,
        },
      },
    ],
  };
}

export async function executeRemoteTokenSend(
  request: AuthenticatedRequest,
  response: Response,
  input: RemoteTokenSendInput,
) {
  const row = asRecord(input.row);
  const meterId = readString(row, ["meterId", "MeterId", "meterNo", "MeterNo"]);
  if (!meterId) {
    throw new Error("Selected meter is missing a meterId.");
  }

  const customerId = readString(row, ["customerId", "CustomerId", "customerNo"]) ?? meterId;
  const customerName = readString(row, ["customerName", "CustomerName", "consumerName", "name"]);
  const stationId = readString(row, ["stationId", "StationId", "siteId", "site"]);
  const protocolId = resolveProtocolId(row);

  let resolvedCredit: CreditResolution | null = null;
  if (input.operation === "send-credit") {
    if (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error("Amount must be greater than zero for credit delivery.");
    }

    resolvedCredit = await resolveCreditValues(
      request,
      response,
      row,
      input.loadMode ?? "naira",
      input.amount,
    );
  }

  const generateConfig = buildGenerateAttempts({
    row,
    operation: input.operation,
    meterId,
    amount: resolvedCredit?.amount,
    unit: resolvedCredit?.unit,
  });
  const generateAttempts = generateConfig.candidates.flatMap((candidate) => {
    const generatePlan = buildUpstreamRequestPlan(generateConfig.pathname, candidate.body);
    return generatePlan.candidateBodies.map((body, index) => ({
      label: `${candidate.label}-${index + 1}`,
      body,
    }));
  });
  const generated = await forwardCandidates(
    request,
    response,
    generateConfig.pathname,
    generateAttempts,
  );

  if (generated.result.statusCode >= 400 || generated.result.payload.code !== 0) {
    throw new Error(generated.result.payload.reason || "Token generation failed.");
  }

  const tokenValue = extractTokenValue(generated.result.payload.result);
  if (!tokenValue) {
    throw new Error("Token generation succeeded but no token value was returned.");
  }
  const remoteCandidates = buildRemoteDeliveryCandidates({
    meterId,
    customerId,
    customerName,
    stationId,
    tokenValue,
    tokenType: input.operation === "clear-credit" ? "clear-credit" : "credit",
    taskName: input.taskName,
    scheduleDate: input.scheduleDate,
    operatorReason: input.operatorReason,
  });
  const gprsCandidates = buildGprsDeliveryCandidates({
    meterId,
    customerId,
    customerName,
    stationId,
    tokenValue,
    protocolId,
    taskName: input.taskName,
    operatorReason: input.operatorReason,
  });
  const isDirectGprsCandidate = looksLikeDirectGprsMeter(row);
  const directCredential = resolveDirectSendCredential(stationId);
  let delivery: ForwardCandidatesResult;
  let deliveryPath = "/API/RemoteMeterTask/CreateTokenTask";
  let deliveryMode: "remote-task" | "gprs-task" = "remote-task";
  let deliveryAuthSource: string | null = null;

  if (isDirectGprsCandidate) {
    const directFailures: RemoteAttemptFailure[] = [];
    const gprsPath = "/API/GPRSMeterTask/GPRSCreateTokenTask";
    let directDeliveryResult: ForwardCandidatesResult | null = null;
    const requestSessionPermissions =
      Array.isArray(request.authSession?.user.permissions) &&
      request.authSession.user.permissions.length > 0
        ? request.authSession.user.permissions
        : extractUpstreamPermissions(request.upstreamCookie);

    if (request.upstreamCookie) {
      if (!hasUpstreamPermission(requestSessionPermissions, GPRS_TOKEN_TASK_PERMISSION)) {
        directFailures.push({
          label: "request-session:gprs-permission-check",
          statusCode: 403,
          reason: `Authenticated upstream session is missing ${GPRS_TOKEN_TASK_PERMISSION}.`,
        });
      } else {
        const withRequestSession = await forwardCandidatesWithAuthToken(
          gprsPath,
          request.upstreamCookie,
          gprsCandidates,
        );
        directFailures.push(
          ...withRequestSession.failures.map((failure) => ({
            ...failure,
            label: `request-session:${failure.label}`,
          })),
        );
        if (withRequestSession.result.statusCode < 400 && withRequestSession.result.payload.code === 0) {
          directDeliveryResult = withRequestSession;
          deliveryPath = gprsPath;
          deliveryMode = "gprs-task";
          deliveryAuthSource = "request-session";
        }
      }
    }

    if (!directDeliveryResult && directCredential) {
      let directAuthToken: string | undefined;
      let directLoginFailure: RemoteAttemptFailure | null = null;

      if (directCredential.token) {
        directAuthToken = directCredential.token;
      } else if (directCredential.username && directCredential.password) {
        const login = await loginToUpstream({
          username: directCredential.username,
          password: directCredential.password,
        });
        if (
          login.upstreamCookie &&
          login.statusCode < 400 &&
          login.payload.code === 0
        ) {
          directAuthToken = login.upstreamCookie;
        } else {
          directLoginFailure = {
            label: `${directCredential.source}:login`,
            statusCode: login.statusCode,
            reason: login.payload.reason || "Direct-send upstream login failed",
          };
        }
      }

      if (directAuthToken) {
        const stationPermissions = extractUpstreamPermissions(directAuthToken);
        if (!hasUpstreamPermission(stationPermissions, GPRS_TOKEN_TASK_PERMISSION)) {
          directFailures.push({
            label: `${directCredential.source}:gprs-permission-check`,
            statusCode: 403,
            reason: `Configured direct-send account is missing ${GPRS_TOKEN_TASK_PERMISSION}.`,
          });
        } else {
          const withStationCredential = await forwardCandidatesWithAuthToken(
            gprsPath,
            directAuthToken,
            gprsCandidates,
          );
          directFailures.push(
            ...withStationCredential.failures.map((failure) => ({
              ...failure,
              label: `${directCredential.source}:${failure.label}`,
            })),
          );
          if (
            withStationCredential.result.statusCode < 400 &&
            withStationCredential.result.payload.code === 0
          ) {
            directDeliveryResult = withStationCredential;
            deliveryPath = gprsPath;
            deliveryMode = "gprs-task";
            deliveryAuthSource = directCredential.source;
          }
        }
      } else if (directLoginFailure) {
        directFailures.push(directLoginFailure);
      }
    }

    if (directDeliveryResult) {
      delivery = {
        ...directDeliveryResult,
        failures: directFailures,
      };
    } else {
      const remoteDelivery = await forwardCandidates(
        request,
        response,
        "/API/RemoteMeterTask/CreateTokenTask",
        remoteCandidates,
      );
      delivery = {
        ...remoteDelivery,
        failures: [
          ...directFailures,
          ...remoteDelivery.failures,
        ],
      };
      deliveryPath = "/API/RemoteMeterTask/CreateTokenTask";
      deliveryMode = "remote-task";
      deliveryAuthSource = request.upstreamCookie ? "request-session" : null;
    }
  } else {
    delivery = await forwardCandidates(
      request,
      response,
      "/API/RemoteMeterTask/CreateTokenTask",
      remoteCandidates,
    );
    deliveryAuthSource = request.upstreamCookie ? "request-session" : null;
  }

  const deliverySucceeded =
    delivery.result.statusCode < 400 && delivery.result.payload.code === 0;
  const maskedToken = maskTokenValue(tokenValue);
  const processedAt = new Date().toISOString();
  const receiptNumber = `RMT-${meterId}-${Date.now()}`;
  const deliveryPayload = asRecord(delivery.result.payload.result);
  const remoteSendRef =
    readString(deliveryPayload, ["id", "taskId", "taskNo", "taskCode", "name"]) ??
    delivery.successfulLabel;

  if (isSupabaseDbEnabled()) {
    void insertRemoteTask({
      meter_sn: meterId,
      site_code: stationId ?? undefined,
      task_type: input.operation === "clear-credit" ? "clear-credit-token" : "credit-token",
      payload: {
        operation: input.operation,
        loadMode: input.loadMode ?? null,
        amount: resolvedCredit?.amount ?? null,
        unit: resolvedCredit?.unit ?? null,
        tokenValue: maskedToken,
        candidate: delivery.successfulLabel,
        deliveryPath,
        deliveryMode,
        deliveryAuthSource,
      },
      result: delivery.result.payload as unknown as Record<string, unknown>,
      status: deliverySucceeded ? "completed" : "failed",
      initiated_by: request.authSession?.user.id ?? null,
      error_message: deliverySucceeded ? null : delivery.result.payload.reason,
      sent_at: processedAt,
      completed_at: processedAt,
    });

    void insertAuditLog({
      actor_user_id: request.authSession?.user.id ?? null,
      action: deliverySucceeded ? "remote-token-send-succeeded" : "remote-token-send-failed",
      entity_type: "remote-token-send",
      entity_id: meterId,
      site_code: stationId ?? undefined,
      request_id:
        typeof response.locals?.traceId === "string" ? response.locals.traceId : null,
      metadata: {
        operation: input.operation,
        candidate: delivery.successfulLabel,
        failures: delivery.failures.slice(0, 4),
        receiptNumber,
        deliveryPath,
        deliveryMode,
        deliveryAuthSource,
      },
    });
  }

  return {
    success: deliverySucceeded,
    message: deliverySucceeded
      ? `Remote token sent to meter ${meterId}.`
      : "Token generated, but remote delivery did not complete. Check the token task monitor or use the generated token manually.",
    details: {
      receiptNumber,
      processedAt,
      meterId,
      customerId,
      customerName,
      stationId,
      operation: input.operation,
      requestedAmount: input.amount ?? null,
      loadMode: input.loadMode ?? null,
      resolvedAmount: resolvedCredit?.amount ?? null,
      resolvedUnit: resolvedCredit?.unit ?? null,
      pricingSource: resolvedCredit?.source ?? null,
      generatedBy: generated.successfulLabel,
      deliveredBy: delivery.successfulLabel,
      deliveryPath,
      deliveryMode,
      deliveryAuthSource,
      remoteSendRef,
      deliveryFailures: delivery.failures,
      generationFailures: generated.failures,
      tokenValue,
      tokenValueMasked: maskedToken,
    },
  };
}




