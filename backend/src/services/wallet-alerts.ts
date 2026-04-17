import { randomUUID } from "node:crypto";
import { insertNotification, isSupabaseDbEnabled } from "./supabase-db.js";
import {
  getWalletDomainState,
  nowIso,
  type WalletOperationalAlertRecord,
  type WalletRequestContext,
} from "./wallet-domain-store.js";

function canViewAlerts(context: WalletRequestContext) {
  return ["super_admin", "admin", "finance", "ops_manager", "vendor_manager", "vendor_user"].includes(
    context.appRole,
  );
}

function isInternalRole(context: WalletRequestContext) {
  return ["super_admin", "admin", "finance", "ops_manager"].includes(context.appRole);
}

function pushAlertToNotifications(alert: WalletOperationalAlertRecord) {
  if (!isSupabaseDbEnabled()) {
    return;
  }

  void insertNotification({
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    site_code: alert.siteCode,
    source: "wallet-alerts",
    payload: {
      category: alert.category,
      vendorId: alert.vendorId,
      walletId: alert.walletId,
      ...alert.metadata,
    },
  });
}

export const walletAlertsService = {
  emit(input: Omit<WalletOperationalAlertRecord, "id" | "createdAt">) {
    const existing = getWalletDomainState().operationalAlerts.find(
      (alert) => alert.dedupeKey === input.dedupeKey,
    );
    if (existing) {
      existing.message = input.message;
      existing.metadata = input.metadata;
      existing.severity = input.severity;
      existing.title = input.title;
      existing.siteCode = input.siteCode;
      existing.vendorId = input.vendorId;
      existing.walletId = input.walletId;
      return existing;
    }

    const alert: WalletOperationalAlertRecord = {
      id: randomUUID(),
      category: input.category,
      severity: input.severity,
      title: input.title,
      message: input.message,
      source: input.source,
      siteCode: input.siteCode,
      vendorId: input.vendorId,
      walletId: input.walletId,
      dedupeKey: input.dedupeKey,
      metadata: input.metadata,
      createdAt: nowIso(),
    };
    getWalletDomainState().operationalAlerts.unshift(alert);
    if (getWalletDomainState().operationalAlerts.length > 500) {
      getWalletDomainState().operationalAlerts.length = 500;
    }
    pushAlertToNotifications(alert);
    return alert;
  },

  list(context: WalletRequestContext, filters: { severity?: string; category?: string } = {}) {
    if (!canViewAlerts(context)) {
      throw new Error("You are not allowed to view wallet alerts");
    }

    const rows = getWalletDomainState().operationalAlerts
      .filter((alert) => {
        if (filters.severity && alert.severity !== filters.severity) {
          return false;
        }
        if (filters.category && alert.category !== filters.category) {
          return false;
        }
        if (isInternalRole(context)) {
          if (context.appRole === "ops_manager" && context.siteCode) {
            return alert.siteCode === context.siteCode;
          }
          return true;
        }

        return alert.vendorId === context.vendorId;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return {
      rows,
      total: rows.length,
    };
  },

  syncNearExhaustionAlerts() {
    const businessDate = nowIso().slice(0, 10);
    for (const wallet of getWalletDomainState().wallets.values()) {
      if (wallet.availableBalance > 1_000) {
        continue;
      }

      this.emit({
        category: "near_exhaustion",
        severity: wallet.availableBalance <= 250 ? "critical" : "warning",
        title: "Vendor Wallet Near Exhaustion",
        message: `Wallet ${wallet.id} is close to exhaustion with available balance ${wallet.availableBalance}.`,
        source: "wallet-settlement",
        siteCode: wallet.siteCode,
        vendorId: wallet.vendorId,
        walletId: wallet.id,
        dedupeKey: `near-exhaustion:${businessDate}:${wallet.id}`,
        metadata: {
          availableBalance: wallet.availableBalance,
          reservedBalance: wallet.reservedBalance,
        },
      });
    }
  },
};

export function getWalletAlertsService() {
  return walletAlertsService;
}
