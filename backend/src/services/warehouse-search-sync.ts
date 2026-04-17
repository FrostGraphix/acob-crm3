import type { Response } from "express";
import { extractRows, readString, type ReportRow } from "../lib/upstream-data.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import {
  upsertWarehouseCustomers,
  upsertWarehouseMeters,
  type DbWarehouseCustomer,
  type DbWarehouseMeter,
} from "./supabase-db.js";
import { forwardWithUpstreamSessionRecovery } from "./upstream-session.js";
import { forwardToUpstream } from "./upstream.js";

function normalizeSiteCode(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
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

function buildReadBody(query: string, siteId: string | null, pageSize: number) {
  return {
    pageNumber: 1,
    pageSize,
    page: 1,
    limit: pageSize,
    searchTerm: query,
    searchWord: query,
    keyword: query,
    keyWord: query,
    name: query,
    itemName: query,
    ...(siteId
      ? {
          siteId,
          site: siteId,
          stationId: siteId,
          station: siteId,
          sectionId: siteId,
        }
      : {}),
  };
}

async function fetchRows(
  request: AuthenticatedRequest,
  response: Response,
  pathname: string,
  body: Record<string, unknown>,
) {
  const result = await forwardWithUpstreamSessionRecovery(request, response, (upstreamCookie) =>
    forwardToUpstream(pathname, body, upstreamCookie, { timeoutMs: 45_000 }),
  );

  if (result.statusCode >= 400 || result.payload.code !== 0) {
    return [] as ReportRow[];
  }

  return extractRows(result.payload.result);
}

function readCustomerId(row: ReportRow) {
  return (
    readString(row, ["customerId", "customerNo", "userId", "certifiNo"]) ??
    readString(row, ["accountNo", "accountId"]) ??
    readString(row, ["meterId", "meterSN", "meterNo", "meterCode"]) ??
    null
  );
}

function readCustomerName(row: ReportRow) {
  return readString(row, ["customerName", "name", "customer", "userName"]);
}

function readMeterId(row: ReportRow) {
  return readString(row, ["meterId", "meterSN", "meterNo", "meterCode", "MeterSN"]);
}

function readAccountNo(row: ReportRow) {
  return readString(row, ["accountNo", "accountId", "certifiNo"]);
}

function readSite(row: ReportRow) {
  return readString(
    row,
    ["stationId", "siteId", "site", "station", "siteName", "stationName", "sectionId"],
  );
}

function readTimestamp(row: ReportRow, keys: string[]) {
  return readString(row, keys) ?? null;
}

function deriveCustomerKey(row: ReportRow) {
  const upstreamId = readCustomerId(row);
  if (upstreamId) {
    return upstreamId;
  }

  const name = readCustomerName(row) ?? "unknown";
  const accountNo = readAccountNo(row) ?? "no-account";
  const siteCode = normalizeSiteCode(readSite(row)) ?? "unknown-site";
  return `derived:${siteCode}:${accountNo}:${name.toLowerCase()}`;
}

function mapCustomerRow(row: ReportRow): DbWarehouseCustomer | null {
  const customerName = readCustomerName(row);
  if (!customerName) {
    return null;
  }

  return {
    upstream_customer_id: deriveCustomerKey(row),
    customer_name: customerName,
    account_no: readAccountNo(row),
    phone: readString(row, ["phone", "mobile", "telephone", "tel"]),
    email: readString(row, ["email", "mail"]),
    address: readString(row, ["address", "customerAddress", "addr"]),
    site_code: normalizeSiteCode(readSite(row)),
    source: "upstream-search-sync",
    raw_payload: row,
  };
}

function mapMeterRow(row: ReportRow): DbWarehouseMeter | null {
  const meterSn = readMeterId(row);
  if (!meterSn) {
    return null;
  }

  return {
    upstream_meter_id: meterSn,
    meter_sn: meterSn,
    site_code: normalizeSiteCode(readSite(row)),
    status: readString(row, ["status", "meterStatus", "state"]),
    meter_type: readString(row, ["meterType", "type", "meterCategory"]),
    tariff_id: readString(row, ["tariffId", "priceId", "tariffCode"]),
    gateway_id: readString(row, ["gatewayId", "gatewayNo", "collectorId"]),
    installed_at: readTimestamp(row, ["installedAt", "installTime", "installDate"]),
    last_seen_at: readTimestamp(row, ["lastSeenAt", "lastReadAt", "updateTime", "createTime"]),
    raw_payload: row,
  };
}

export interface WarehouseSearchSyncResult {
  customersSynced: number;
  metersSynced: number;
}

export async function syncWarehouseSearchSeed(
  request: AuthenticatedRequest,
  response: Response,
  args: {
    query: string;
    siteId?: string | null;
    limit?: number;
  },
): Promise<WarehouseSearchSyncResult> {
  const query = args.query.trim();
  if (!query) {
    return {
      customersSynced: 0,
      metersSynced: 0,
    };
  }

  const pageSize = Math.max(25, Math.min(250, (args.limit ?? 12) * 4));
  const siteId = normalizeSiteCode(args.siteId);
  const readBody = buildReadBody(query, siteId, pageSize);

  const [customerRows, meterRows] = await Promise.all([
    fetchRows(request, response, "/api/customer/read", readBody),
    fetchRows(request, response, "/api/meter/read", {
      ...readBody,
      meterId: query,
      meterNo: query,
      meterCode: query,
    }),
  ]);

  const [customersSynced, metersSynced] = await Promise.all([
    upsertWarehouseCustomers(customerRows.map(mapCustomerRow).filter((row): row is DbWarehouseCustomer => row !== null)),
    upsertWarehouseMeters(meterRows.map(mapMeterRow).filter((row): row is DbWarehouseMeter => row !== null)),
  ]);

  return {
    customersSynced,
    metersSynced,
  };
}
