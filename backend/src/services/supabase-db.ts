import type { SupabaseClient } from "@supabase/supabase-js";
import type { TheftCaseRecord, TheftSignalRecord } from "../../../common/types/index.js";
import { env } from "./env.js";

type SupabaseModule = typeof import("@supabase/supabase-js");

let supabaseModulePromise: Promise<SupabaseModule> | null = null;
let supabaseDbClientPromise: Promise<SupabaseClient> | null = null;

const hasDbConfig =
  env.supabaseUrl.length > 0 && env.supabaseServiceRoleKey.length > 0;

async function getSupabaseModule() {
  if (!supabaseModulePromise) {
    supabaseModulePromise = import("@supabase/supabase-js");
  }

  return supabaseModulePromise;
}

async function getDbClient(): Promise<SupabaseClient> {
  if (!hasDbConfig) {
    throw new Error(
      "Supabase database is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)",
    );
  }

  if (!supabaseDbClientPromise) {
    supabaseDbClientPromise = (async () => {
      const { createClient } = await getSupabaseModule();
      return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      });
    })();
  }

  return supabaseDbClientPromise;
}

function normalizeSiteCode(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function readObject(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function mapSiteLabelToCode(value: string | null | undefined) {
  const normalized = normalizeSiteCode(value);
  if (!normalized) {
    return null;
  }

  if (normalized.includes("musha")) {
    return "musha";
  }
  if (normalized.includes("ogufa")) {
    return "ogufa";
  }
  if (normalized.includes("umaisha")) {
    return "umaisha";
  }
  if (normalized.includes("tunga")) {
    return "tunga";
  }
  if (normalized.includes("kyakale")) {
    return "kyakale";
  }

  return normalized;
}

function toSiteDisplayName(code: string | null | undefined) {
  switch (normalizeSiteCode(code)) {
    case "musha":
      return "Musha";
    case "ogufa":
      return "Ogufa";
    case "umaisha":
      return "Umaisha";
    case "tunga":
      return "Tunga";
    case "kyakale":
      return "Kyakale";
    default:
      return null;
  }
}

function toIsoDateString(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function periodBounds(label: string, granularity: "daily" | "monthly" | "yearly") {
  if (granularity === "daily") {
    return {
      start: label,
      end: label,
    };
  }

  if (granularity === "monthly") {
    const [year, month] = label.split("-");
    const monthNumber = Number(month);
    const yearNumber = Number(year);
    if (!Number.isFinite(yearNumber) || !Number.isFinite(monthNumber)) {
      return null;
    }

    const start = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
    const endDate = new Date(Date.UTC(yearNumber, monthNumber, 0));
    return {
      start,
      end: endDate.toISOString().slice(0, 10),
    };
  }

  const yearNumber = Number(label);
  if (!Number.isFinite(yearNumber)) {
    return null;
  }

  return {
    start: `${label}-01-01`,
    end: `${label}-12-31`,
  };
}

export function isSupabaseDbEnabled() {
  return hasDbConfig;
}

export interface DbNotification {
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  meter_id?: string | null;
  source?: string;
  site_code?: string | null;
  user_id?: string | null;
  created_by?: string | null;
  payload?: Record<string, unknown>;
}

interface DbNotificationRow {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export async function insertNotification(notification: DbNotification) {
  const client = await getDbClient();
  const payload = {
    ...(notification.payload ?? {}),
    ...(notification.meter_id ? { meterId: notification.meter_id } : {}),
    ...(notification.source ? { source: notification.source } : {}),
  };

  const { data, error } = await client
    .from("notifications")
    .insert({
      audience: notification.user_id ? "user" : "global",
      user_id: notification.user_id ?? null,
      target_site_code: normalizeSiteCode(notification.site_code),
      category: notification.source ?? "analysis",
      severity: notification.severity,
      title: notification.title,
      message: notification.message,
      payload,
      created_by: notification.created_by ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[SupabaseDB] Failed to insert notification:", error.message);
    return null;
  }

  return data;
}

export async function listUnreadNotifications(userId?: string | null): Promise<DbNotificationRow[]> {
  const client = await getDbClient();
  const { data, error } = await client
    .from("notifications")
    .select("id, severity, title, message, payload, created_at, audience, user_id, expires_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[SupabaseDB] Failed to list notifications:", error.message);
    return [];
  }

  const notifications = (data ?? []).filter((row) => {
    const audience = readString((row as Record<string, unknown>).audience) ?? "global";
    const targetUserId = readString((row as Record<string, unknown>).user_id);
    const expiresAt = readString((row as Record<string, unknown>).expires_at);

    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      return false;
    }

    if (audience === "user") {
      return Boolean(userId && targetUserId === userId);
    }

    return audience === "global";
  });

  if (!userId || notifications.length === 0) {
    return notifications as DbNotificationRow[];
  }

  const notificationIds = notifications.map((row) => String((row as Record<string, unknown>).id));
  const { data: receipts, error: receiptError } = await client
    .from("notification_receipts")
    .select("notification_id, read_at, dismissed_at")
    .eq("user_id", userId)
    .in("notification_id", notificationIds);

  if (receiptError) {
    console.error("[SupabaseDB] Failed to list notification receipts:", receiptError.message);
    return notifications as DbNotificationRow[];
  }

  const dismissedIds = new Set(
    (receipts ?? [])
      .filter((row) => Boolean(row.read_at || row.dismissed_at))
      .map((row) => row.notification_id),
  );

  return notifications.filter(
    (row) => !dismissedIds.has(String((row as Record<string, unknown>).id)),
  ) as DbNotificationRow[];
}

export async function markNotificationsRead(ids: string[], userId?: string | null) {
  if (ids.length === 0 || !userId) {
    return 0;
  }

  const client = await getDbClient();
  const timestamp = new Date().toISOString();
  const rows = ids.map((notificationId) => ({
    notification_id: notificationId,
    user_id: userId,
    read_at: timestamp,
    dismissed_at: timestamp,
  }));

  const { error } = await client
    .from("notification_receipts")
    .upsert(rows, { onConflict: "notification_id,user_id" });

  if (error) {
    console.error("[SupabaseDB] Failed to mark notifications read:", error.message);
    return 0;
  }

  return rows.length;
}

export async function markAllNotificationsRead(userId?: string | null) {
  if (!userId) {
    return 0;
  }

  const unread = await listUnreadNotifications(userId);
  return markNotificationsRead(
    unread.map((row) => row.id),
    userId,
  );
}

export interface DbDocument {
  uploaded_by?: string | null;
  category?: string;
  title: string;
  description?: string | null;
  file_name: string;
  file_size?: number | null;
  mime_type?: string | null;
  storage_path: string;
  meter_id?: string | null;
  customer_id?: string | null;
  site_id?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export async function insertDocument(document: DbDocument) {
  const client = await getDbClient();
  const entityType = document.meter_id
    ? "meter"
    : document.customer_id
      ? "customer"
      : null;
  const entityId = document.meter_id ?? document.customer_id ?? null;

  const metadata = {
    ...(document.metadata ?? {}),
    ...(document.category ? { category: document.category } : {}),
    ...(document.description ? { description: document.description } : {}),
    ...(document.tags ? { tags: document.tags } : {}),
    ...(document.customer_id ? { customerId: document.customer_id } : {}),
    ...(document.meter_id ? { meterId: document.meter_id } : {}),
    title: document.title,
  };

  const { data, error } = await client
    .from("documents")
    .insert({
      bucket_name: env.supabaseStorageBucket,
      storage_path: document.storage_path,
      file_name: document.file_name,
      content_type: document.mime_type ?? null,
      size_bytes: document.file_size ?? null,
      entity_type: entityType,
      entity_id: entityId,
      site_code: normalizeSiteCode(document.site_id),
      uploaded_by: document.uploaded_by ?? null,
      metadata,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[SupabaseDB] Failed to insert document:", error.message);
    return null;
  }

  return data;
}

export interface DbAuditLog {
  actor_user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  site_code?: string | null;
  source?: string;
  request_id?: string | null;
  metadata?: Record<string, unknown>;
}

function isUuid(value: string | null | undefined) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  );
}

function normalizeAuditAction(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("login")) {
    return "login";
  }
  if (normalized.includes("logout")) {
    return "logout";
  }
  if (normalized.includes("upload")) {
    return "upload";
  }
  if (normalized.includes("download")) {
    return "download";
  }
  if (normalized.includes("delete")) {
    return "delete";
  }
  if (normalized.includes("export")) {
    return "export";
  }
  if (normalized.includes("import")) {
    return "import";
  }
  if (normalized.includes("remote")) {
    return "remote_command";
  }
  if (normalized.includes("role")) {
    return "role_change";
  }
  if (normalized.includes("engine") || normalized.includes("reconciliation") || normalized.includes("settlement")) {
    return "engine_run";
  }
  if (normalized.includes("update") || normalized.includes("approve") || normalized.includes("suspend")) {
    return "update";
  }
  return "create";
}

export async function insertAuditLog(entry: DbAuditLog) {
  const client = await getDbClient();
  const { data, error } = await client
    .from("audit_logs")
    .insert({
      user_id: isUuid(entry.actor_user_id) ? entry.actor_user_id : null,
      action: normalizeAuditAction(entry.action),
      resource: entry.entity_type,
      resource_id: entry.entity_id ?? null,
      detail: {
        siteCode: normalizeSiteCode(entry.site_code),
        source: entry.source ?? "backend",
        requestId: entry.request_id ?? null,
        ...(entry.metadata ?? {}),
      },
    })
    .select("id")
    .single();

  if (error) {
    console.error("[SupabaseDB] Failed to insert audit log:", error.message);
    return null;
  }

  return data;
}

export interface DbImportJob {
  source?: string;
  entity_type: string;
  status?: "pending" | "running" | "completed" | "failed" | "cancelled";
  requested_by?: string | null;
  summary?: Record<string, unknown>;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export async function createImportJob(job: DbImportJob) {
  const client = await getDbClient();
  const { data, error } = await client
    .from("import_jobs")
    .insert({
      source: job.source ?? "ui",
      entity_type: job.entity_type,
      status: job.status ?? "pending",
      requested_by: job.requested_by ?? null,
      summary: job.summary ?? {},
      error_message: job.error_message ?? null,
      started_at: job.started_at ?? null,
      completed_at: job.completed_at ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[SupabaseDB] Failed to create import job:", error.message);
    return null;
  }

  return data;
}

export async function updateImportJob(jobId: string, patch: Partial<DbImportJob>) {
  const client = await getDbClient();
  const { error } = await client
    .from("import_jobs")
    .update({
      ...(patch.source !== undefined ? { source: patch.source } : {}),
      ...(patch.entity_type !== undefined ? { entity_type: patch.entity_type } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.requested_by !== undefined ? { requested_by: patch.requested_by } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.error_message !== undefined ? { error_message: patch.error_message } : {}),
      ...(patch.started_at !== undefined ? { started_at: patch.started_at } : {}),
      ...(patch.completed_at !== undefined ? { completed_at: patch.completed_at } : {}),
    })
    .eq("id", jobId);

  if (error) {
    console.error("[SupabaseDB] Failed to update import job:", error.message);
    return false;
  }

  return true;
}

export async function listDocuments(options?: {
  category?: string;
  meterId?: string;
  customerId?: string;
  siteId?: string;
  limit?: number;
}) {
  const client = await getDbClient();
  let query = client
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 100);

  const normalizedSite = normalizeSiteCode(options?.siteId);
  if (normalizedSite) {
    query = query.eq("site_code", normalizedSite);
  }

  if (options?.meterId) {
    query = query.eq("entity_type", "meter").eq("entity_id", options.meterId);
  } else if (options?.customerId) {
    query = query.eq("entity_type", "customer").eq("entity_id", options.customerId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[SupabaseDB] Failed to list documents:", error.message);
    return [];
  }

  const documents = data ?? [];
  if (!options?.category) {
    return documents;
  }

  return documents.filter((row) => {
    const category = (row.metadata as Record<string, unknown> | null)?.category;
    return category === options.category;
  });
}

export async function getDocumentById(documentId: string) {
  const client = await getDbClient();
  const { data, error } = await client
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();

  if (error) {
    console.error("[SupabaseDB] Failed to load document:", error.message);
    return null;
  }

  return data;
}

export interface DbTokenTransaction {
  meter_sn: string;
  site_id: string;
  customer_name?: string | null;
  account_no?: string | null;
  amount: number;
  kwh: number;
  tariff_rate?: string;
  transaction_ts: string;
  upstream_id?: string | null;
}

export async function upsertTokenTransactions(transactions: DbTokenTransaction[]) {
  if (transactions.length === 0) {
    return 0;
  }

  const client = await getDbClient();
  const mapped = transactions
    .map((transaction) => ({
      upstream_transaction_id: transaction.upstream_id ?? null,
      meter_sn: transaction.meter_sn,
      site_code: normalizeSiteCode(transaction.site_id),
      amount: transaction.amount,
      kwh: transaction.kwh,
      tariff_rate: transaction.tariff_rate ?? null,
      transaction_at: transaction.transaction_ts,
      raw_payload: {
        customerName: transaction.customer_name ?? null,
        accountNo: transaction.account_no ?? null,
      },
    }))
    .filter((transaction) => Boolean(transaction.site_code && transaction.transaction_at));

  if (mapped.length === 0) {
    return 0;
  }

  const { count, error } = await client
    .from("token_transactions")
    .upsert(mapped, { onConflict: "upstream_transaction_id", count: "exact" });

  if (error) {
    console.error("[SupabaseDB] Failed to upsert token transactions:", error.message);
    return 0;
  }

  return count ?? mapped.length;
}

export interface DbMeterDailyRead {
  meter_id: string;
  site_id: string;
  read_date: string;
  consumption_kwh: number;
  source?: string;
}

export async function upsertMeterDailyReads(reads: DbMeterDailyRead[]) {
  if (reads.length === 0) {
    return 0;
  }

  const client = await getDbClient();
  const mapped = reads
    .map((read) => ({
      meter_sn: read.meter_id,
      site_code: normalizeSiteCode(read.site_id),
      reading_date: read.read_date,
      consumption_kwh: read.consumption_kwh,
      raw_payload: {
        source: read.source ?? "site-consumption-engine",
      },
    }))
    .filter((read) => Boolean(read.site_code));

  if (mapped.length === 0) {
    return 0;
  }

  const { count, error } = await client
    .from("meter_daily_reads")
    .upsert(mapped, { onConflict: "meter_sn,reading_date", count: "exact" });

  if (error) {
    console.error("[SupabaseDB] Failed to upsert daily reads:", error.message);
    return 0;
  }

  return count ?? mapped.length;
}

export interface DbCustomerDailyRechargeFact {
  meter_sn: string;
  fact_date: string;
  site_id?: string | null;
  customer_name?: string | null;
  account_no?: string | null;
  recharge_amount: number;
  recharge_kwh: number;
  recharge_count: number;
  last_transaction_at?: string | null;
  generated_at?: string;
}

export interface DbCustomerDailyConsumptionFact {
  meter_sn: string;
  fact_date: string;
  site_id?: string | null;
  customer_name?: string | null;
  account_no?: string | null;
  consumption_kwh: number;
  last_read_at?: string | null;
  generated_at?: string;
}

export interface DbCustomerSegmentFact {
  meter_sn: string;
  customer_name?: string | null;
  account_no?: string | null;
  site_id?: string | null;
  segment: string;
  recharge_count_30d: number;
  total_recharge_amount_30d: number;
  avg_daily_consumption_7d: number;
  generated_at?: string;
  metadata?: Record<string, unknown>;
}

export interface DbCustomerForecastFact {
  meter_sn: string;
  customer_name?: string | null;
  site_id?: string | null;
  avg_daily_consumption_7d: number;
  avg_recharge_kwh_30d: number;
  estimated_days_covered: number;
  predicted_next_recharge_date?: string | null;
  generated_at?: string;
  metadata?: Record<string, unknown>;
}

export interface DbRevenueLeakageFact {
  meter_sn: string;
  customer_name?: string | null;
  site_id?: string | null;
  leakage_score: number;
  estimated_loss_kwh: number;
  reasons: string[];
  generated_at?: string;
  metadata?: Record<string, unknown>;
}

export interface DbOperationalPriorityFact {
  meter_sn: string;
  customer_name?: string | null;
  site_id?: string | null;
  priority_score: number;
  recommended_action: string;
  reasons: string[];
  generated_at?: string;
  metadata?: Record<string, unknown>;
}

export async function upsertCustomerDailyRechargeFacts(facts: DbCustomerDailyRechargeFact[]) {
  if (facts.length === 0) {
    return 0;
  }

  const client = await getDbClient();
  const mapped = facts
    .map((fact) => ({
      meter_sn: fact.meter_sn,
      fact_date: fact.fact_date,
      site_code: normalizeSiteCode(fact.site_id),
      customer_name: fact.customer_name ?? null,
      account_no: fact.account_no ?? null,
      recharge_amount: fact.recharge_amount,
      recharge_kwh: fact.recharge_kwh,
      recharge_count: fact.recharge_count,
      last_transaction_at: fact.last_transaction_at ?? null,
      generated_at: fact.generated_at ?? new Date().toISOString(),
    }))
    .filter((fact) => Boolean(fact.meter_sn && fact.fact_date));

  if (mapped.length === 0) {
    return 0;
  }

  const { count, error } = await client
    .from("customer_daily_recharge_facts")
    .upsert(mapped, { onConflict: "meter_sn,fact_date", count: "exact" });

  if (error) {
    console.error("[SupabaseDB] Failed to upsert customer recharge facts:", error.message);
    return 0;
  }

  return count ?? mapped.length;
}

export async function upsertCustomerDailyConsumptionFacts(facts: DbCustomerDailyConsumptionFact[]) {
  if (facts.length === 0) {
    return 0;
  }

  const client = await getDbClient();
  const mapped = facts
    .map((fact) => ({
      meter_sn: fact.meter_sn,
      fact_date: fact.fact_date,
      site_code: normalizeSiteCode(fact.site_id),
      customer_name: fact.customer_name ?? null,
      account_no: fact.account_no ?? null,
      consumption_kwh: fact.consumption_kwh,
      last_read_at: fact.last_read_at ?? null,
      generated_at: fact.generated_at ?? new Date().toISOString(),
    }))
    .filter((fact) => Boolean(fact.meter_sn && fact.fact_date));

  if (mapped.length === 0) {
    return 0;
  }

  const { count, error } = await client
    .from("customer_daily_consumption_facts")
    .upsert(mapped, { onConflict: "meter_sn,fact_date", count: "exact" });

  if (error) {
    console.error("[SupabaseDB] Failed to upsert customer consumption facts:", error.message);
    return 0;
  }

  return count ?? mapped.length;
}

export async function upsertCustomerSegments(facts: DbCustomerSegmentFact[]) {
  if (facts.length === 0) {
    return 0;
  }

  const client = await getDbClient();
  const mapped = facts
    .map((fact) => ({
      meter_sn: fact.meter_sn,
      customer_name: fact.customer_name ?? null,
      account_no: fact.account_no ?? null,
      site_code: normalizeSiteCode(fact.site_id),
      segment: fact.segment,
      recharge_count_30d: fact.recharge_count_30d,
      total_recharge_amount_30d: fact.total_recharge_amount_30d,
      avg_daily_consumption_7d: fact.avg_daily_consumption_7d,
      generated_at: fact.generated_at ?? new Date().toISOString(),
      metadata: fact.metadata ?? {},
    }))
    .filter((fact) => Boolean(fact.meter_sn && fact.segment));

  if (mapped.length === 0) {
    return 0;
  }

  const { count, error } = await client
    .from("customer_segments")
    .upsert(mapped, { onConflict: "meter_sn", count: "exact" });

  if (error) {
    console.error("[SupabaseDB] Failed to upsert customer segments:", error.message);
    return 0;
  }

  return count ?? mapped.length;
}

export async function upsertCustomerForecasts(facts: DbCustomerForecastFact[]) {
  if (facts.length === 0) {
    return 0;
  }

  const client = await getDbClient();
  const mapped = facts
    .map((fact) => ({
      meter_sn: fact.meter_sn,
      customer_name: fact.customer_name ?? null,
      site_code: normalizeSiteCode(fact.site_id),
      avg_daily_consumption_7d: fact.avg_daily_consumption_7d,
      avg_recharge_kwh_30d: fact.avg_recharge_kwh_30d,
      estimated_days_covered: fact.estimated_days_covered,
      predicted_next_recharge_date: fact.predicted_next_recharge_date ?? null,
      generated_at: fact.generated_at ?? new Date().toISOString(),
      metadata: fact.metadata ?? {},
    }))
    .filter((fact) => Boolean(fact.meter_sn));

  if (mapped.length === 0) {
    return 0;
  }

  const { count, error } = await client
    .from("customer_forecasts")
    .upsert(mapped, { onConflict: "meter_sn", count: "exact" });

  if (error) {
    console.error("[SupabaseDB] Failed to upsert customer forecasts:", error.message);
    return 0;
  }

  return count ?? mapped.length;
}

export async function upsertRevenueLeakageFacts(facts: DbRevenueLeakageFact[]) {
  if (facts.length === 0) {
    return 0;
  }

  const client = await getDbClient();
  const mapped = facts
    .map((fact) => ({
      meter_sn: fact.meter_sn,
      customer_name: fact.customer_name ?? null,
      site_code: normalizeSiteCode(fact.site_id),
      leakage_score: fact.leakage_score,
      estimated_loss_kwh: fact.estimated_loss_kwh,
      reasons: fact.reasons,
      generated_at: fact.generated_at ?? new Date().toISOString(),
      metadata: fact.metadata ?? {},
    }))
    .filter((fact) => Boolean(fact.meter_sn));

  if (mapped.length === 0) {
    return 0;
  }

  const { count, error } = await client
    .from("revenue_leakage_facts")
    .upsert(mapped, { onConflict: "meter_sn", count: "exact" });

  if (error) {
    console.error("[SupabaseDB] Failed to upsert revenue leakage facts:", error.message);
    return 0;
  }

  return count ?? mapped.length;
}

export async function upsertOperationalPriorityFacts(facts: DbOperationalPriorityFact[]) {
  if (facts.length === 0) {
    return 0;
  }

  const client = await getDbClient();
  const mapped = facts
    .map((fact) => ({
      meter_sn: fact.meter_sn,
      customer_name: fact.customer_name ?? null,
      site_code: normalizeSiteCode(fact.site_id),
      priority_score: fact.priority_score,
      recommended_action: fact.recommended_action,
      reasons: fact.reasons,
      generated_at: fact.generated_at ?? new Date().toISOString(),
      metadata: fact.metadata ?? {},
    }))
    .filter((fact) => Boolean(fact.meter_sn));

  if (mapped.length === 0) {
    return 0;
  }

  const { count, error } = await client
    .from("operational_priority_queue")
    .upsert(mapped, { onConflict: "meter_sn", count: "exact" });

  if (error) {
    console.error("[SupabaseDB] Failed to upsert operational priority facts:", error.message);
    return 0;
  }

  return count ?? mapped.length;
}

async function selectRows(
  table: string,
  options: {
    meterId?: string | null;
    accountNo?: string | null;
    siteId?: string | null;
    fromDate?: string | null;
    toDate?: string | null;
    limit?: number;
  } = {},
) {
  const client = await getDbClient();
  let query = client.from(table).select("*");

  if (options.meterId) {
    query = query.eq("meter_sn", options.meterId);
  }
  if (options.accountNo) {
    query = query.eq("account_no", options.accountNo);
  }
  if (options.siteId) {
    query = query.eq("site_code", normalizeSiteCode(options.siteId));
  }
  if (options.fromDate) {
    query = query.gte("fact_date", options.fromDate);
  }
  if (options.toDate) {
    query = query.lte("fact_date", options.toDate);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query.order("fact_date", { ascending: false });
  if (error) {
    console.error(`[SupabaseDB] Failed to select rows from ${table}:`, error.message);
    return [];
  }

  return data ?? [];
}

export async function listCustomerDailyRechargeFacts(options: {
  meterId?: string | null;
  accountNo?: string | null;
  siteId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  limit?: number;
} = {}) {
  return selectRows("customer_daily_recharge_facts", options);
}

export async function listCustomerDailyConsumptionFacts(options: {
  meterId?: string | null;
  accountNo?: string | null;
  siteId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  limit?: number;
} = {}) {
  return selectRows("customer_daily_consumption_facts", options);
}

export async function listCustomerSegments(options: { siteId?: string | null; limit?: number } = {}) {
  const client = await getDbClient();
  let query = client
    .from("customer_segments")
    .select("*")
    .order("total_recharge_amount_30d", { ascending: false });

  if (options.siteId) {
    query = query.eq("site_code", normalizeSiteCode(options.siteId));
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[SupabaseDB] Failed to list customer segments:", error.message);
    return [];
  }
  return data ?? [];
}

export async function listCustomerForecasts(options: { siteId?: string | null; limit?: number } = {}) {
  const client = await getDbClient();
  let query = client
    .from("customer_forecasts")
    .select("*")
    .order("estimated_days_covered", { ascending: true });

  if (options.siteId) {
    query = query.eq("site_code", normalizeSiteCode(options.siteId));
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[SupabaseDB] Failed to list customer forecasts:", error.message);
    return [];
  }
  return data ?? [];
}

export async function listRevenueLeakageFacts(options: { siteId?: string | null; limit?: number } = {}) {
  const client = await getDbClient();
  let query = client
    .from("revenue_leakage_facts")
    .select("*")
    .order("leakage_score", { ascending: false });

  if (options.siteId) {
    query = query.eq("site_code", normalizeSiteCode(options.siteId));
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[SupabaseDB] Failed to list revenue leakage facts:", error.message);
    return [];
  }
  return data ?? [];
}

export async function listOperationalPriorityFacts(options: { siteId?: string | null; limit?: number } = {}) {
  const client = await getDbClient();
  let query = client
    .from("operational_priority_queue")
    .select("*")
    .order("priority_score", { ascending: false });

  if (options.siteId) {
    query = query.eq("site_code", normalizeSiteCode(options.siteId));
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[SupabaseDB] Failed to list operational priority facts:", error.message);
    return [];
  }
  return data ?? [];
}

export interface DbRevenueUsagePoint {
  date: string;
  siteCode: string | null;
  dayKwh: number;
  nightKwh: number;
  totalKwh: number;
  dayRevenue: number;
  nightRevenue: number;
  totalRevenue: number;
  transactionCount: number;
}

export async function listRevenueUsageSeries(options?: {
  siteId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  limit?: number;
}): Promise<DbRevenueUsagePoint[]> {
  const client = await getDbClient();
  let query = client
    .from("token_transactions_daily_v")
    .select("*")
    .order("transaction_date", { ascending: true })
    .limit(options?.limit ?? 400);

  const normalizedSite = normalizeSiteCode(options?.siteId);
  if (normalizedSite) {
    query = query.eq("site_code", normalizedSite);
  }

  if (options?.fromDate) {
    query = query.gte("transaction_date", options.fromDate);
  }

  if (options?.toDate) {
    query = query.lte("transaction_date", options.toDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[SupabaseDB] Failed to load revenue usage series:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    date: readString((row as Record<string, unknown>).transaction_date) ?? "",
    siteCode: normalizeSiteCode(readString((row as Record<string, unknown>).site_code)),
    dayKwh: readNumber((row as Record<string, unknown>).day_kwh) ?? 0,
    nightKwh: readNumber((row as Record<string, unknown>).night_kwh) ?? 0,
    totalKwh: readNumber((row as Record<string, unknown>).total_kwh) ?? 0,
    dayRevenue: readNumber((row as Record<string, unknown>).day_revenue) ?? 0,
    nightRevenue: readNumber((row as Record<string, unknown>).night_revenue) ?? 0,
    totalRevenue: readNumber((row as Record<string, unknown>).total_revenue) ?? 0,
    transactionCount: readNumber((row as Record<string, unknown>).transaction_count) ?? 0,
  }));
}

export interface DbMeterConsumptionRankRow {
  meterId: string;
  customerId: string | null;
  customerName: string;
  siteCode: string | null;
  dayKwh: number;
  nightKwh: number;
  totalKwh: number;
  totalRevenue: number;
  lastTransactionAt: string | null;
}

export async function listMeterConsumptionRanking(options?: {
  siteId?: string | null;
  limit?: number;
}): Promise<DbMeterConsumptionRankRow[]> {
  const client = await getDbClient();
  let query = client
    .from("meter_consumption_rank_v")
    .select("site_code, meter_sn, customer_id, day_kwh, night_kwh, total_kwh, total_revenue, last_transaction_at")
    .order("total_kwh", { ascending: false })
    .limit(options?.limit ?? 50);

  const normalizedSite = normalizeSiteCode(options?.siteId);
  if (normalizedSite) {
    query = query.eq("site_code", normalizedSite);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[SupabaseDB] Failed to load meter consumption ranking:", error.message);
    return [];
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const customerIds = rows
    .map((row) => readString(row.customer_id))
    .filter((value): value is string => value !== null);
  const customerNameMap = new Map<string, string>();

  if (customerIds.length > 0) {
    const { data: customerRows, error: customerError } = await client
      .from("customers")
      .select("id, customer_name")
      .in("id", customerIds);

    if (customerError) {
      console.error("[SupabaseDB] Failed to hydrate customer names:", customerError.message);
    } else {
      for (const customerRow of customerRows ?? []) {
        const customerId = readString((customerRow as Record<string, unknown>).id);
        const customerName = readString((customerRow as Record<string, unknown>).customer_name);
        if (customerId && customerName) {
          customerNameMap.set(customerId, customerName);
        }
      }
    }
  }

  return rows.map((row) => {
    const customerId = readString(row.customer_id);
    return {
      meterId: readString(row.meter_sn) ?? "",
      customerId,
      customerName: customerId ? customerNameMap.get(customerId) ?? "" : "",
      siteCode: normalizeSiteCode(readString(row.site_code)),
      dayKwh: readNumber(row.day_kwh) ?? 0,
      nightKwh: readNumber(row.night_kwh) ?? 0,
      totalKwh: readNumber(row.total_kwh) ?? 0,
      totalRevenue: readNumber(row.total_revenue) ?? 0,
      lastTransactionAt: readString(row.last_transaction_at),
    };
  });
}

export interface DbSiteConsumptionPoint {
  date: string;
  siteCode: string | null;
  totalKwh: number;
}

export async function listSiteConsumptionSeries(options?: {
  siteId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  granularity?: "daily" | "monthly" | "yearly";
  limit?: number;
}): Promise<DbSiteConsumptionPoint[]> {
  const client = await getDbClient();
  let query = client
    .from("site_consumption_facts")
    .select("site_code, period_start, consumption_kwh")
    .eq("period_granularity", options?.granularity ?? "daily")
    .order("period_start", { ascending: true })
    .limit(options?.limit ?? 400);

  const normalizedSite = normalizeSiteCode(options?.siteId);
  if (normalizedSite) {
    query = query.eq("site_code", normalizedSite);
  }

  if (options?.fromDate) {
    query = query.gte("period_start", options.fromDate);
  }

  if (options?.toDate) {
    query = query.lte("period_start", options.toDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[SupabaseDB] Failed to load site consumption series:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    date: readString((row as Record<string, unknown>).period_start) ?? "",
    siteCode: normalizeSiteCode(readString((row as Record<string, unknown>).site_code)),
    totalKwh: readNumber((row as Record<string, unknown>).consumption_kwh) ?? 0,
  }));
}

export interface DbWarehouseCustomer {
  upstream_customer_id: string;
  customer_name: string;
  account_no?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  site_code?: string | null;
  source?: string | null;
  raw_payload?: Record<string, unknown>;
}

export interface DbWarehouseMeter {
  upstream_meter_id: string;
  meter_sn: string;
  customer_id?: string | null;
  account_id?: string | null;
  site_code?: string | null;
  status?: string | null;
  meter_type?: string | null;
  tariff_id?: string | null;
  gateway_id?: string | null;
  installed_at?: string | null;
  last_seen_at?: string | null;
  raw_payload?: Record<string, unknown>;
}

export interface DbWarehouseAccount {
  upstream_account_id: string;
  customer_id?: string | null;
  account_no: string;
  status?: string | null;
  site_code?: string | null;
  opened_at?: string | null;
  closed_at?: string | null;
  raw_payload?: Record<string, unknown>;
}

export interface DbRuntimeHealthFact {
  engine_name: string;
  category?: string | null;
  site_code?: string | null;
  status: "healthy" | "warning" | "critical" | "offline";
  freshness_score: number;
  dataset_age_minutes: number;
  last_success_at?: string | null;
  last_failure_at?: string | null;
  last_refreshed_at?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
  generated_at?: string;
}

export async function upsertWarehouseCustomers(rows: DbWarehouseCustomer[]) {
  if (rows.length === 0) {
    return 0;
  }

  const client = await getDbClient();
  const deduped = new Map<string, DbWarehouseCustomer>();
  for (const row of rows) {
    const upstreamCustomerId = readString(row.upstream_customer_id);
    const customerName = readString(row.customer_name);
    if (!upstreamCustomerId || !customerName) {
      continue;
    }

    deduped.set(upstreamCustomerId, {
      upstream_customer_id: upstreamCustomerId,
      customer_name: customerName,
      account_no: readString(row.account_no),
      phone: readString(row.phone),
      email: readString(row.email),
      address: readString(row.address),
      site_code: normalizeSiteCode(row.site_code),
      source: readString(row.source) ?? "upstream-search-sync",
      raw_payload: row.raw_payload ?? {},
    });
  }

  const mapped = Array.from(deduped.values());
  if (mapped.length === 0) {
    return 0;
  }

  const { count, error } = await client
    .from("customers")
    .upsert(mapped, { onConflict: "upstream_customer_id", count: "exact" });

  if (error) {
    console.error("[SupabaseDB] Failed to upsert warehouse customers:", error.message);
    return 0;
  }

  return count ?? mapped.length;
}

export async function upsertWarehouseAccounts(rows: DbWarehouseAccount[]) {
  if (rows.length === 0) {
    return 0;
  }

  const client = await getDbClient();
  const deduped = new Map<string, DbWarehouseAccount>();
  for (const row of rows) {
    const accountNo = readString(row.account_no);
    if (!accountNo) {
      continue;
    }

    deduped.set(accountNo, {
      upstream_account_id: readString(row.upstream_account_id) ?? accountNo,
      customer_id: readString(row.customer_id),
      account_no: accountNo,
      status: readString(row.status),
      site_code: normalizeSiteCode(row.site_code),
      opened_at: readString(row.opened_at),
      closed_at: readString(row.closed_at),
      raw_payload: row.raw_payload ?? {},
    });
  }

  const mapped = Array.from(deduped.values());
  if (mapped.length === 0) {
    return 0;
  }

  const { count, error } = await client
    .from("accounts")
    .upsert(mapped, { onConflict: "account_no", count: "exact" });

  if (error) {
    console.error("[SupabaseDB] Failed to upsert warehouse accounts:", error.message);
    return 0;
  }

  return count ?? mapped.length;
}

export async function upsertWarehouseMeters(rows: DbWarehouseMeter[]) {
  if (rows.length === 0) {
    return 0;
  }

  const client = await getDbClient();
  const deduped = new Map<string, DbWarehouseMeter>();
  for (const row of rows) {
    const meterSn = readString(row.meter_sn);
    if (!meterSn) {
      continue;
    }

    deduped.set(meterSn, {
      upstream_meter_id: readString(row.upstream_meter_id) ?? meterSn,
      meter_sn: meterSn,
      customer_id: readString(row.customer_id),
      account_id: readString(row.account_id),
      site_code: normalizeSiteCode(row.site_code),
      status: readString(row.status),
      meter_type: readString(row.meter_type),
      tariff_id: readString(row.tariff_id),
      gateway_id: readString(row.gateway_id),
      installed_at: readString(row.installed_at),
      last_seen_at: readString(row.last_seen_at),
      raw_payload: row.raw_payload ?? {},
    });
  }

  const mapped = Array.from(deduped.values());
  if (mapped.length === 0) {
    return 0;
  }

  const { count, error } = await client
    .from("meters")
    .upsert(mapped, { onConflict: "meter_sn", count: "exact" });

  if (error) {
    console.error("[SupabaseDB] Failed to upsert warehouse meters:", error.message);
    return 0;
  }

  return count ?? mapped.length;
}

export async function upsertRuntimeHealthFacts(rows: DbRuntimeHealthFact[]) {
  if (rows.length === 0) {
    return 0;
  }

  const client = await getDbClient();
  const deduped = new Map<string, DbRuntimeHealthFact>();
  for (const row of rows) {
    const engineName = readString(row.engine_name);
    if (!engineName) {
      continue;
    }

    deduped.set(engineName, {
      engine_name: engineName,
      category: readString(row.category),
      site_code: normalizeSiteCode(row.site_code),
      status: row.status,
      freshness_score: Math.max(0, Math.min(100, Number(row.freshness_score ?? 0))),
      dataset_age_minutes: Math.max(0, Math.round(Number(row.dataset_age_minutes ?? 0))),
      last_success_at: readString(row.last_success_at),
      last_failure_at: readString(row.last_failure_at),
      last_refreshed_at: readString(row.last_refreshed_at),
      error_message: readString(row.error_message),
      metadata: row.metadata ?? {},
      generated_at: readString(row.generated_at) ?? new Date().toISOString(),
    });
  }

  const mapped = Array.from(deduped.values());
  if (mapped.length === 0) {
    return 0;
  }

  const { count, error } = await client
    .from("runtime_health_facts")
    .upsert(mapped, { onConflict: "engine_name", count: "exact" });

  if (error) {
    console.error("[SupabaseDB] Failed to upsert runtime health facts:", error.message);
    return 0;
  }

  return count ?? mapped.length;
}

export interface DbGlobalSearchResult {
  entityType: "customer" | "meter" | "document" | "theft-case";
  id: string;
  title: string;
  subtitle: string;
  siteCode: string | null;
  metadata: Record<string, unknown>;
  updatedAt: string | null;
}

export async function searchWarehouseEntities(args: {
  query: string;
  siteId?: string | null;
  limit?: number;
}): Promise<DbGlobalSearchResult[]> {
  const client = await getDbClient();
  const term = args.query.trim();
  if (term.length === 0) {
    return [];
  }

  const normalizedSite = normalizeSiteCode(args.siteId);
  const limit = Math.max(1, Math.min(25, args.limit ?? 12));
  const likePattern = `%${term}%`;
  const lowerTerm = term.toLowerCase();
  const webSearchTerm = term
    .split(/\s+/)
    .map((token) => token.replace(/[':&|!()]/g, " ").trim())
    .filter((token) => token.length > 0)
    .join(" & ");

  const [
    customerResponse,
    meterResponse,
    documentResponse,
    theftCaseResponse,
  ] = await Promise.all([
    client
      .from("customers")
      .select("id, upstream_customer_id, customer_name, account_no, phone, email, address, site_code, updated_at")
      .or(
        webSearchTerm.length > 0
          ? `search_document.fts.simple.${webSearchTerm},customer_name.ilike.${likePattern},account_no.ilike.${likePattern},phone.ilike.${likePattern},email.ilike.${likePattern}`
          : `customer_name.ilike.${likePattern},account_no.ilike.${likePattern},phone.ilike.${likePattern},email.ilike.${likePattern}`,
      )
      .limit(limit),
    client
      .from("meters")
      .select("id, upstream_meter_id, meter_sn, customer_id, account_id, status, meter_type, tariff_id, gateway_id, site_code, updated_at")
      .or(
        webSearchTerm.length > 0
          ? `search_document.fts.simple.${webSearchTerm},meter_sn.ilike.${likePattern},status.ilike.${likePattern},gateway_id.ilike.${likePattern},tariff_id.ilike.${likePattern}`
          : `meter_sn.ilike.${likePattern},status.ilike.${likePattern},gateway_id.ilike.${likePattern},tariff_id.ilike.${likePattern}`,
      )
      .limit(limit),
    client
      .from("documents")
      .select("id, file_name, storage_path, entity_type, entity_id, site_code, metadata, updated_at")
      .or(`file_name.ilike.${likePattern},storage_path.ilike.${likePattern}`)
      .limit(limit),
    client
      .from("theft_cases")
      .select("id, meter_sn, site_code, severity, score, status, notes, updated_at")
      .or(`meter_sn.ilike.${likePattern},notes.ilike.${likePattern},status.ilike.${likePattern}`)
      .limit(limit),
  ]);

  const scopedRows = <T extends Record<string, unknown>>(rows: T[] | null | undefined) =>
    (rows ?? []).filter((row) => !normalizedSite || normalizeSiteCode(readString(row.site_code)) === normalizedSite);

  const results: DbGlobalSearchResult[] = [];
  const scopedCustomerRows = scopedRows(customerResponse.data as Array<Record<string, unknown>>);
  const scopedMeterRows = scopedRows(meterResponse.data as Array<Record<string, unknown>>);
  const customerRowsById = new Map<string, Record<string, unknown>>();
  const customerIds = new Set<string>();
  const meterByCustomerId = new Map<string, Record<string, unknown>>();

  for (const row of scopedCustomerRows) {
    const customerId = readString(row.id);
    if (!customerId) {
      continue;
    }

    customerRowsById.set(customerId, row);
    customerIds.add(customerId);
  }

  for (const row of scopedMeterRows) {
    const customerId = readString(row.customer_id);
    if (!customerId) {
      continue;
    }

    customerIds.add(customerId);
    if (!meterByCustomerId.has(customerId)) {
      meterByCustomerId.set(customerId, row);
    }
  }

  if (customerIds.size > 0) {
    const { data: hydratedCustomers, error: hydratedCustomersError } = await client
      .from("customers")
      .select("id, upstream_customer_id, customer_name, account_no, phone, email, address, site_code, updated_at")
      .in("id", Array.from(customerIds));

    if (!hydratedCustomersError) {
      for (const row of scopedRows(hydratedCustomers as Array<Record<string, unknown>>)) {
        const customerId = readString(row.id);
        if (!customerId) {
          continue;
        }

        customerRowsById.set(customerId, row);
      }
    }
  }

  if (!customerResponse.error) {
    for (const row of scopedCustomerRows) {
      const customerId = readString(row.id);
      const linkedMeter = customerId ? meterByCustomerId.get(customerId) : null;
      const title = readString(row.customer_name) ?? "Unnamed customer";
      const subtitle = [readString(row.account_no), readString(row.phone), readString(row.email)]
        .filter((value): value is string => value !== null)
        .join(" • ");
      results.push({
        entityType: "customer",
        id: readString(row.id) ?? title,
        title,
        subtitle,
        siteCode: normalizeSiteCode(readString(row.site_code)),
        metadata: {
          upstreamCustomerId: readString(row.upstream_customer_id),
          accountNo: readString(row.account_no),
          phone: readString(row.phone),
          email: readString(row.email),
          address: readString(row.address),
          meterSn: readString(linkedMeter?.meter_sn),
          meterType: readString(linkedMeter?.meter_type),
          status: readString(linkedMeter?.status),
        },
        updatedAt: readString(row.updated_at),
      });
    }
  } else {
    console.error("[SupabaseDB] Failed to search customers:", customerResponse.error.message);
  }

  if (!meterResponse.error) {
    for (const row of scopedMeterRows) {
      const customerId = readString(row.customer_id);
      const customerRow = customerId ? customerRowsById.get(customerId) : null;
      const title = readString(row.meter_sn) ?? "Unknown meter";
      const subtitle = [
        readString(customerRow?.customer_name),
        readString(customerRow?.account_no),
        readString(row.status),
        readString(row.meter_type),
      ]
        .filter((value): value is string => value !== null)
        .join(" • ");
      results.push({
        entityType: "meter",
        id: readString(row.id) ?? title,
        title,
        subtitle,
        siteCode: normalizeSiteCode(readString(row.site_code)),
        metadata: {
          upstreamMeterId: readString(row.upstream_meter_id),
          customerId,
          accountId: readString(row.account_id),
          customerName: readString(customerRow?.customer_name),
          accountNo: readString(customerRow?.account_no),
          meterType: readString(row.meter_type),
          status: readString(row.status),
          tariffId: readString(row.tariff_id),
          gatewayId: readString(row.gateway_id),
        },
        updatedAt: readString(row.updated_at),
      });
    }
  } else {
    console.error("[SupabaseDB] Failed to search meters:", meterResponse.error.message);
  }

  if (!documentResponse.error) {
    for (const row of scopedRows(documentResponse.data as Array<Record<string, unknown>>)) {
      const metadata = readObject(row.metadata) ?? {};
      const title =
        readString(metadata.title) ??
        readString(row.file_name) ??
        "Document";
      const subtitle = [
        readString(metadata.category),
        readString(row.entity_type),
        readString(row.entity_id),
      ]
        .filter((value): value is string => value !== null)
        .join(" • ");
      results.push({
        entityType: "document",
        id: readString(row.id) ?? title,
        title,
        subtitle,
        siteCode: normalizeSiteCode(readString(row.site_code)),
        metadata: {
          fileName: readString(row.file_name),
          entityType: readString(row.entity_type),
          entityId: readString(row.entity_id),
          category: readString(metadata.category),
          storagePath: readString((row as Record<string, unknown>).storage_path),
        },
        updatedAt: readString(row.updated_at),
      });
    }
  } else {
    console.error("[SupabaseDB] Failed to search documents:", documentResponse.error.message);
  }

  if (!theftCaseResponse.error) {
    for (const row of scopedRows(theftCaseResponse.data as Array<Record<string, unknown>>)) {
      const title = readString(row.meter_sn) ?? "Theft case";
      const subtitle = [readString(row.status), readString(row.severity)]
        .filter((value): value is string => value !== null)
        .join(" • ");
      const notes = readString(row.notes);
      results.push({
        entityType: "theft-case",
        id: readString(row.id) ?? title,
        title,
        subtitle,
        siteCode: normalizeSiteCode(readString(row.site_code)),
        metadata: {
          status: readString(row.status),
          severity: readString(row.severity),
          score: readNumber(row.score),
          notes,
        },
        updatedAt: readString(row.updated_at),
      });
    }
  } else {
    console.error("[SupabaseDB] Failed to search theft cases:", theftCaseResponse.error.message);
  }

  return results
    .map((result) => ({
      ...result,
      metadata: result.metadata,
      subtitle: result.subtitle || (result.siteCode ? `${result.siteCode.toUpperCase()} site` : ""),
    }))
    .sort((left, right) => {
      const leftTitle = left.title.toLowerCase();
      const rightTitle = right.title.toLowerCase();
      const leftStarts = leftTitle.startsWith(lowerTerm) ? 1 : 0;
      const rightStarts = rightTitle.startsWith(lowerTerm) ? 1 : 0;
      if (leftStarts !== rightStarts) {
        return rightStarts - leftStarts;
      }

      const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
      const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, limit);
}

interface SiteConsumptionStateRecord {
  snapshot: {
    generatedAt: string;
    sourceWindow: {
      fromDate: string;
      toDate: string;
    };
    summary: Array<{
      site: string;
      totalConsumption: number;
    }>;
    daily: {
      labels: string[];
      series: Array<{
        site: string;
        values: number[];
      }>;
    };
    monthly: {
      labels: string[];
      series: Array<{
        site: string;
        values: number[];
      }>;
    };
    yearly: {
      labels: string[];
      series: Array<{
        site: string;
        values: number[];
      }>;
    };
  };
  lastUpdatedAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  refreshing: boolean;
}

function normalizeSiteConsumptionSeries(value: unknown) {
  const record = readObject(value);
  const labels = Array.isArray(record?.labels)
    ? record.labels.filter((entry): entry is string => typeof entry === "string")
    : [];
  const series = Array.isArray(record?.series)
    ? record.series
        .map((entry) => {
          const item = readObject(entry);
          const site = readString(item?.site ?? item?.label);
          const normalizedSite = toSiteDisplayName(site);
          if (!normalizedSite) {
            return null;
          }

          const values = Array.isArray(item?.values)
            ? item.values.map((point) => readNumber(point) ?? 0).slice(0, labels.length)
            : [];
          return {
            site: normalizedSite,
            values: [...values, ...labels.slice(values.length).map(() => 0)],
          };
        })
        .filter((entry): entry is { site: string; values: number[] } => entry !== null)
    : [];

  return { labels, series };
}

export async function saveSiteConsumptionStateRecord(state: unknown) {
  const stateRecord = readObject(state);
  const snapshot = readObject(stateRecord?.snapshot ?? stateRecord);
  if (!snapshot) {
    return false;
  }

  const sourceWindow = readObject(snapshot.sourceWindow);
  const generatedAt = readString(snapshot.generatedAt) ?? new Date().toISOString();
  const fromDate = readString(sourceWindow?.fromDate) ?? generatedAt.slice(0, 10);
  const toDate = readString(sourceWindow?.toDate) ?? generatedAt.slice(0, 10);
  const daily = normalizeSiteConsumptionSeries(snapshot.daily);
  const monthly = normalizeSiteConsumptionSeries(snapshot.monthly);
  const yearly = normalizeSiteConsumptionSeries(snapshot.yearly);
  const allFacts: Array<{
    site_code: string;
    period_granularity: "daily" | "monthly" | "yearly";
    period_start: string;
    period_end: string;
    consumption_kwh: number;
    generated_at: string;
    metadata: Record<string, unknown>;
  }> = [];

  const addFacts = (
    granularity: "daily" | "monthly" | "yearly",
    series: { labels: string[]; series: Array<{ site: string; values: number[] }> },
  ) => {
    for (const entry of series.series) {
      const siteCode = mapSiteLabelToCode(entry.site);
      if (!siteCode) {
        continue;
      }

      for (let index = 0; index < series.labels.length; index += 1) {
        const label = series.labels[index];
        if (!label) {
          continue;
        }
        const value = entry.values[index] ?? 0;
        const bounds = periodBounds(label, granularity);
        if (!bounds) {
          continue;
        }

        allFacts.push({
          site_code: siteCode,
          period_granularity: granularity,
          period_start: bounds.start,
          period_end: bounds.end,
          consumption_kwh: value,
          generated_at: generatedAt,
          metadata: {
            label,
            sourceWindow: {
              fromDate,
              toDate,
            },
          },
        });
      }
    }
  };

  addFacts("daily", daily);
  addFacts("monthly", monthly);
  addFacts("yearly", yearly);

  if (allFacts.length === 0) {
    return false;
  }

  const client = await getDbClient();
  const { error } = await client
    .from("site_consumption_facts")
    .upsert(allFacts, {
      onConflict: "site_code,period_granularity,period_start,period_end",
    });

  if (error) {
    console.error("[SupabaseDB] Failed to upsert site consumption facts:", error.message);
    return false;
  }

  return true;
}

export async function loadSiteConsumptionStateRecord(): Promise<SiteConsumptionStateRecord | null> {
  const client = await getDbClient();
  const { data, error } = await client
    .from("site_consumption_facts")
    .select("*")
    .order("generated_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("[SupabaseDB] Failed to load site consumption facts:", error.message);
    return null;
  }

  const rows = data ?? [];
  const latestGeneratedAt = readString(rows[0]?.generated_at);
  if (!latestGeneratedAt) {
    return null;
  }

  const latestRows = rows.filter((row) => row.generated_at === latestGeneratedAt);
  const sourceWindowRecord = readObject(readObject(latestRows[0]?.metadata)?.sourceWindow);
  const sourceWindow = {
    fromDate: readString(sourceWindowRecord?.fromDate) ?? latestGeneratedAt.slice(0, 10),
    toDate: readString(sourceWindowRecord?.toDate) ?? latestGeneratedAt.slice(0, 10),
  };

  const buildSeries = (granularity: "daily" | "monthly" | "yearly") => {
    const rowsForGranularity = latestRows.filter(
      (row) => row.period_granularity === granularity,
    );
    const labelSet = new Set<string>();
    const siteMap = new Map<string, Map<string, number>>();

    for (const row of rowsForGranularity) {
      const label =
        readString(readObject(row.metadata)?.label) ??
        (granularity === "yearly"
          ? row.period_start.slice(0, 4)
          : granularity === "monthly"
            ? row.period_start.slice(0, 7)
            : row.period_start.slice(0, 10));
      const site = toSiteDisplayName(row.site_code);
      if (!site) {
        continue;
      }

      labelSet.add(label);
      const bucket = siteMap.get(site) ?? new Map<string, number>();
      bucket.set(label, readNumber(row.consumption_kwh) ?? 0);
      siteMap.set(site, bucket);
    }

    const labels = Array.from(labelSet).sort((left, right) => left.localeCompare(right));
    const series = Array.from(siteMap.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([site, values]) => ({
        site,
        values: labels.map((label) => values.get(label) ?? 0),
      }));

    return { labels, series };
  };

  const daily = buildSeries("daily");
  const monthly = buildSeries("monthly");
  const yearly = buildSeries("yearly");
  const summaryMap = new Map<string, number>();

  for (const entry of daily.series) {
    summaryMap.set(
      entry.site,
      entry.values.reduce((total, value) => total + value, 0),
    );
  }

  return {
    snapshot: {
      generatedAt: latestGeneratedAt,
      sourceWindow,
      summary: Array.from(summaryMap.entries()).map(([site, totalConsumption]) => ({
        site,
        totalConsumption,
      })),
      daily,
      monthly,
      yearly,
    },
    lastUpdatedAt: latestGeneratedAt,
    lastAttemptAt: latestGeneratedAt,
    lastError: null,
    refreshing: false,
  };
}

interface DbTheftSignalInput {
  id: string;
  meterId: string;
  customerName?: string;
  siteId?: string;
  severity: "watch" | "suspect" | "critical";
  score: number;
  signalTypes: string[];
  title: string;
  message: string;
  status: "active" | "resolved";
  createdAt: string;
  updatedAt: string;
}

interface DbTheftCaseInput {
  id: string;
  meterId: string;
  customerName?: string;
  siteId?: string;
  severity: "watch" | "suspect" | "critical";
  score: number;
  status: "new" | "active" | "investigating" | "confirmed-theft" | "false-positive" | "closed";
  signalIds: string[];
  owner?: string;
  ownerUserId?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export async function loadTheftRuntimeSnapshot(): Promise<{
  signals: TheftSignalRecord[];
  cases: TheftCaseRecord[];
  signalKeys: string[];
} | null> {
  const client = await getDbClient();
  const [{ data: signalRows, error: signalError }, { data: caseRows, error: caseError }] =
    await Promise.all([
      client.from("theft_signals").select("*").order("created_at", { ascending: false }).limit(5000),
      client
        .from("theft_cases")
        .select("*, theft_case_signals(theft_signal_id)")
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

  if (signalError) {
    console.error("[SupabaseDB] Failed to load theft signals:", signalError.message);
    return null;
  }

  if (caseError) {
    console.error("[SupabaseDB] Failed to load theft cases:", caseError.message);
    return null;
  }

  const signals: TheftSignalRecord[] = (signalRows ?? []).map((row) => ({
    id: row.id,
    meterId: row.meter_sn,
    customerName: readString(readObject(row.payload)?.customerName) ?? undefined,
    siteId: toSiteDisplayName(row.site_code) ?? undefined,
    severity: row.severity,
    score: readNumber(row.score) ?? 0,
    signalTypes: Array.isArray(row.signal_types) ? row.signal_types : [],
    title: row.title,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const cases: TheftCaseRecord[] = (caseRows ?? []).map((row) => ({
    id: row.id,
    meterId: row.meter_sn,
    customerName: readString(readObject(row.notes)?.customerName) ?? undefined,
    siteId: toSiteDisplayName(row.site_code) ?? undefined,
    severity: row.severity,
    score: readNumber(row.score) ?? 0,
    status: row.status,
    signalIds: Array.isArray(row.theft_case_signals)
      ? row.theft_case_signals
          .map((entry: unknown) => readString(readObject(entry)?.theft_signal_id))
          .filter((entry: string | null): entry is string => entry !== null)
      : [],
    owner: undefined,
    notes: readString(row.notes) ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: readString(row.closed_at) ?? undefined,
  }));

  const signalKeys = signals.map((signal) => {
    const dateKey = toIsoDateString(signal.createdAt) ?? signal.createdAt.slice(0, 10);
    return `${signal.meterId}:${dateKey}`;
  });

  return { signals, cases, signalKeys };
}

export async function upsertTheftSignalRecord(signal: DbTheftSignalInput) {
  const siteCode = mapSiteLabelToCode(signal.siteId);
  if (!siteCode) {
    return false;
  }

  const client = await getDbClient();
  const { error } = await client.from("theft_signals").upsert({
    id: signal.id,
    meter_sn: signal.meterId,
    site_code: siteCode,
    severity: signal.severity,
    score: signal.score,
    signal_types: signal.signalTypes,
    title: signal.title,
    message: signal.message,
    status: signal.status,
    source_window: {
      createdAt: signal.createdAt,
    },
    payload: {
      customerName: signal.customerName ?? null,
    },
    created_at: signal.createdAt,
    updated_at: signal.updatedAt,
  });

  if (error) {
    console.error("[SupabaseDB] Failed to upsert theft signal:", error.message);
    return false;
  }

  return true;
}

export async function upsertTheftCaseRecord(theftCase: DbTheftCaseInput) {
  const siteCode = mapSiteLabelToCode(theftCase.siteId);
  if (!siteCode) {
    return false;
  }

  const client = await getDbClient();
  const { error } = await client.from("theft_cases").upsert({
    id: theftCase.id,
    meter_sn: theftCase.meterId,
    site_code: siteCode,
    severity: theftCase.severity,
    score: theftCase.score,
    status: theftCase.status,
    owner_user_id: theftCase.ownerUserId ?? null,
    notes: theftCase.notes ?? null,
    created_at: theftCase.createdAt,
    updated_at: theftCase.updatedAt,
    closed_at: theftCase.closedAt ?? null,
  });

  if (error) {
    console.error("[SupabaseDB] Failed to upsert theft case:", error.message);
    return false;
  }

  const { error: deleteError } = await client
    .from("theft_case_signals")
    .delete()
    .eq("theft_case_id", theftCase.id);

  if (deleteError) {
    console.error("[SupabaseDB] Failed to reset theft case signals:", deleteError.message);
    return false;
  }

  if (theftCase.signalIds.length > 0) {
    const { error: linkError } = await client.from("theft_case_signals").insert(
      theftCase.signalIds.map((signalId) => ({
        theft_case_id: theftCase.id,
        theft_signal_id: signalId,
      })),
    );

    if (linkError) {
      console.error("[SupabaseDB] Failed to link theft case signals:", linkError.message);
      return false;
    }
  }

  return true;
}

export interface DbRemoteTask {
  meter_sn: string;
  site_code?: string | null;
  task_type: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  status?: "pending" | "running" | "completed" | "success" | "failed" | "cancelled";
  initiated_by?: string | null;
  upstream_task_id?: string | null;
  error_message?: string | null;
  sent_at?: string | null;
  completed_at?: string | null;
}

function mapRemoteTaskStatus(status: DbRemoteTask["status"]) {
  switch (status) {
    case "completed":
    case "success":
      return "completed";
    case "running":
      return "sent";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "pending":
      return "pending";
    default:
      return "pending";
  }
}

export function mapRemoteTaskType(taskType: string) {
  const normalized = taskType.trim().toLowerCase();

  if (
    normalized.includes("read") ||
    normalized.includes("reading")
  ) {
    return "read_meter";
  }

  if (
    normalized.includes("control") ||
    normalized.includes("valve")
  ) {
    return "valve_control";
  }

  if (
    normalized.includes("setting") ||
    normalized.includes("parameter")
  ) {
    return "set_parameter";
  }

  if (normalized.includes("firmware")) {
    return "firmware_upgrade";
  }

  if (
    normalized.includes("key") &&
    !normalized.includes("token")
  ) {
    return "key_change";
  }

  if (normalized.includes("tariff")) {
    return "set_tariff";
  }

  if (normalized.includes("alarm")) {
    return "clear_alarm";
  }

  return "other";
}

export async function insertRemoteTask(task: DbRemoteTask) {
  const siteCode = normalizeSiteCode(task.site_code);
  if (!siteCode) {
    return null;
  }

  const client = await getDbClient();
  const { data, error } = await client
    .from("remote_tasks")
    .insert({
      upstream_task_id: task.upstream_task_id ?? null,
      requested_by: task.initiated_by ?? null,
      meter_sn: task.meter_sn,
      site_code: siteCode,
      task_type: mapRemoteTaskType(task.task_type),
      task_name: task.task_type,
      status: mapRemoteTaskStatus(task.status),
      request_payload: task.payload ?? {},
      response_payload: {
        ...(task.result ?? {}),
        ...(task.error_message ? { errorMessage: task.error_message } : {}),
      },
      queued_at: task.sent_at ?? new Date().toISOString(),
      completed_at: task.completed_at ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[SupabaseDB] Failed to insert remote task:", error.message);
    return null;
  }

  return data;
}

export interface DbAnalysisRun {
  engine_name: string;
  status?: "running" | "completed" | "failed" | "cancelled";
  initiated_by?: string | null;
  started_at?: string;
  completed_at?: string | null;
  duration_ms?: number | null;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
}

export async function createAnalysisRun(run: DbAnalysisRun) {
  const client = await getDbClient();
  const { data, error } = await client
    .from("analysis_runs")
    .insert({
      engine_name: run.engine_name,
      status: run.status ?? "running",
      initiated_by: run.initiated_by ?? null,
      started_at: run.started_at ?? new Date().toISOString(),
      completed_at: run.completed_at ?? null,
      duration_ms: run.duration_ms ?? null,
      error_message: run.error_message ?? null,
      metadata: run.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    console.error("[SupabaseDB] Failed to create analysis run:", error.message);
    return null;
  }

  return data;
}

export async function updateAnalysisRun(runId: string, patch: Partial<DbAnalysisRun>) {
  const client = await getDbClient();
  const { error } = await client
    .from("analysis_runs")
    .update({
      ...(patch.engine_name !== undefined ? { engine_name: patch.engine_name } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.initiated_by !== undefined ? { initiated_by: patch.initiated_by } : {}),
      ...(patch.started_at !== undefined ? { started_at: patch.started_at } : {}),
      ...(patch.completed_at !== undefined ? { completed_at: patch.completed_at } : {}),
      ...(patch.duration_ms !== undefined ? { duration_ms: patch.duration_ms } : {}),
      ...(patch.error_message !== undefined ? { error_message: patch.error_message } : {}),
      ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
    })
    .eq("id", runId);

  if (error) {
    console.error("[SupabaseDB] Failed to update analysis run:", error.message);
    return false;
  }

  return true;
}

export async function checkSupabaseDbHealth() {
  if (!hasDbConfig) {
    return { ok: false, detail: "not configured" };
  }

  try {
    const client = await getDbClient();
    const { data, error } = await client
      .from("sites")
      .select("code")
      .limit(1);

    return {
      ok: !error && Array.isArray(data),
      detail: error ? error.message : `connected (${data?.length ?? 0} rows)`,
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "unknown error",
    };
  }
}
