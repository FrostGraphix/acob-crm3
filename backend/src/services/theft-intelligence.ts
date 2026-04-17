import { randomUUID } from "node:crypto";
import type {
  TheftCaseRecord,
  TheftCaseStatus,
  TheftSignalRecord,
  TheftSignalSeverity,
} from "../../../common/types/index.js";
import { loadRuntimeState, saveRuntimeState } from "./runtime-state-store.js";
import {
  isSupabaseDbEnabled,
  loadTheftRuntimeSnapshot,
  upsertTheftCaseRecord,
  upsertTheftSignalRecord,
} from "./supabase-db.js";

interface TheftRuntimeSnapshot {
  signals: TheftSignalRecord[];
  cases: TheftCaseRecord[];
  signalKeys: string[];
  savedAt: string;
}

interface TheftSignalInput {
  meterId: string;
  customerName?: string;
  siteId?: string;
  signalType: string;
  scoreDelta: number;
  detail: string;
}

function normalizeSiteLabel(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized.includes("musha")) {
    return "Musha";
  }
  if (normalized.includes("ogufa")) {
    return "Ogufa";
  }
  if (normalized.includes("umaisha")) {
    return "Umaisha";
  }
  if (normalized.includes("tunga")) {
    return "Tunga";
  }
  if (normalized.includes("kyakale")) {
    return "Kyakale";
  }

  return undefined;
}

function readSiteFromRow(row: Record<string, unknown>) {
  return normalizeSiteLabel(
    row.stationId ??
      row.stationCode ??
      row.site ??
      row.siteId ??
      row.station ??
      row.sectionId ??
      row.stationName ??
      row.siteName,
  );
}

const persistedState =
  (isSupabaseDbEnabled() ? await loadTheftRuntimeSnapshot() : null) ??
  (await loadRuntimeState<TheftRuntimeSnapshot>("theft-intelligence"));

class TheftIntelligenceService {
  private signals = persistedState?.signals ?? [];
  private cases = persistedState?.cases ?? [];
  private signalKeySet = new Set<string>(persistedState?.signalKeys ?? []);

  private async persist() {
    if (isSupabaseDbEnabled()) {
      return;
    }

    await saveRuntimeState("theft-intelligence", {
      signals: this.signals,
      cases: this.cases,
      signalKeys: Array.from(this.signalKeySet),
      savedAt: new Date().toISOString(),
    } satisfies TheftRuntimeSnapshot);
  }

  private getSeverity(score: number): TheftSignalSeverity {
    if (score >= 70) {
      return "critical";
    }

    if (score >= 40) {
      return "suspect";
    }

    return "watch";
  }

  private getCaseStatusBySeverity(severity: TheftSignalSeverity): TheftCaseStatus {
    return severity === "watch" ? "new" : "active";
  }

  private addSignal(signal: TheftSignalRecord) {
    this.signals.unshift(signal);
    if (this.signals.length > 5000) {
      this.signals.length = 5000;
    }
  }

  private async upsertCaseFromSignal(signal: TheftSignalRecord) {
    if (signal.severity === "watch") {
      return;
    }

    const existingCase = this.cases.find(
      (item) =>
        item.meterId === signal.meterId &&
        ["new", "active", "investigating"].includes(item.status),
    );

    if (existingCase) {
      existingCase.score = Math.max(existingCase.score, signal.score);
      existingCase.severity =
        existingCase.severity === "critical" || signal.severity === "critical"
          ? "critical"
          : "suspect";
      existingCase.signalIds = Array.from(new Set([...existingCase.signalIds, signal.id]));
      existingCase.updatedAt = new Date().toISOString();
      if (isSupabaseDbEnabled()) {
        await upsertTheftCaseRecord(existingCase);
      }
      return;
    }

    const newCase: TheftCaseRecord = {
      id: randomUUID(),
      meterId: signal.meterId,
      customerName: signal.customerName,
      siteId: signal.siteId,
      severity: signal.severity,
      score: signal.score,
      status: this.getCaseStatusBySeverity(signal.severity),
      signalIds: [signal.id],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.cases.unshift(newCase);

    if (this.cases.length > 2000) {
      this.cases.length = 2000;
    }

    if (isSupabaseDbEnabled()) {
      await upsertTheftCaseRecord(newCase);
    }
  }

  public async ingestSignalsFromReports(input: {
    dateBucket: string;
    lowPurchaseRows: Array<Record<string, unknown>>;
    longNonPurchaseRows: Array<Record<string, unknown>>;
  }) {
    const grouped = new Map<string, TheftSignalInput[]>();

    const pushSignal = (signal: TheftSignalInput) => {
      const current = grouped.get(signal.meterId) ?? [];
      current.push(signal);
      grouped.set(signal.meterId, current);
    };

    for (const row of input.lowPurchaseRows) {
      const meterId =
        typeof row.meterId === "string" && row.meterId.trim().length > 0
          ? row.meterId.trim()
          : "";
      if (!meterId) {
        continue;
      }

      const customerName =
        typeof row.customerName === "string" && row.customerName.trim().length > 0
          ? row.customerName.trim()
          : undefined;
      const remainingBalanceRaw = row.remainingBalance;
      const remainingBalance =
        typeof remainingBalanceRaw === "number"
          ? remainingBalanceRaw
          : typeof remainingBalanceRaw === "string"
            ? Number(remainingBalanceRaw)
            : Number.NaN;

      if (!Number.isFinite(remainingBalance)) {
        continue;
      }

      if (remainingBalance <= 100) {
        pushSignal({
          meterId,
          customerName,
          siteId: readSiteFromRow(row),
          signalType: "low-balance-critical",
          scoreDelta: 35,
          detail: `Remaining balance is critically low (${remainingBalance}).`,
        });
      } else if (remainingBalance <= 500) {
        pushSignal({
          meterId,
          customerName,
          siteId: readSiteFromRow(row),
          signalType: "low-balance-warning",
          scoreDelta: 20,
          detail: `Remaining balance is below warning threshold (${remainingBalance}).`,
        });
      }
    }

    for (const row of input.longNonPurchaseRows) {
      const meterId =
        typeof row.meterId === "string" && row.meterId.trim().length > 0
          ? row.meterId.trim()
          : "";
      if (!meterId) {
        continue;
      }

      const customerName =
        typeof row.customerName === "string" && row.customerName.trim().length > 0
          ? row.customerName.trim()
          : undefined;
      const daysRaw =
        row.daysWithoutPurchase ?? row.nonpurchaseDays ?? row.noPurchaseDays ?? row.days;
      const days =
        typeof daysRaw === "number"
          ? daysRaw
          : typeof daysRaw === "string"
            ? Number(daysRaw)
            : Number.NaN;

      if (!Number.isFinite(days)) {
        continue;
      }

      if (days >= 60) {
        pushSignal({
          meterId,
          customerName,
          siteId: readSiteFromRow(row),
          signalType: "long-nonpurchase-critical",
          scoreDelta: 45,
          detail: `No purchase activity for ${days} days.`,
        });
      } else if (days >= 30) {
        pushSignal({
          meterId,
          customerName,
          siteId: readSiteFromRow(row),
          signalType: "long-nonpurchase-warning",
          scoreDelta: 30,
          detail: `No purchase activity for ${days} days.`,
        });
      }
    }

    const now = new Date().toISOString();
    let changed = false;
    const newSignals: TheftSignalRecord[] = [];

    for (const [meterId, signalInputs] of grouped.entries()) {
      const key = `${meterId}:${input.dateBucket}`;
      if (this.signalKeySet.has(key)) {
        continue;
      }

      const combinedTypes = Array.from(new Set(signalInputs.map((item) => item.signalType)));
      const score = Math.min(
        100,
        signalInputs.reduce((total, item) => total + item.scoreDelta, 0) +
          (combinedTypes.length >= 2 ? 10 : 0),
      );
      const severity = this.getSeverity(score);
      const signal: TheftSignalRecord = {
        id: randomUUID(),
        meterId,
        customerName: signalInputs[0]?.customerName,
        siteId: signalInputs.find((item) => item.siteId)?.siteId,
        severity,
        score,
        signalTypes: combinedTypes,
        title: `Theft risk: ${severity}`,
        message: signalInputs.map((item) => item.detail).join(" "),
        status: "active",
        createdAt: now,
        updatedAt: now,
      };

      this.addSignal(signal);
      if (isSupabaseDbEnabled()) {
        await upsertTheftSignalRecord(signal);
      }
      await this.upsertCaseFromSignal(signal);
      this.signalKeySet.add(key);
      newSignals.push(signal);
      changed = true;
    }

    if (this.signalKeySet.size > 8000) {
      this.signalKeySet.clear();
      changed = true;
    }

    if (changed) {
      await this.persist();
    }
  }

  public listSignals() {
    return this.signals;
  }

  public listCases() {
    return this.cases;
  }

  public async createCase(input: {
    meterId: string;
    customerName?: string;
    severity?: TheftSignalSeverity;
    score?: number;
    signalIds?: string[];
    owner?: string;
    notes?: string;
  }) {
    const createdAt = new Date().toISOString();
    const newCase: TheftCaseRecord = {
      id: randomUUID(),
      meterId: input.meterId,
      customerName: input.customerName,
      siteId:
        input.signalIds?.length
          ? this.signals.find((signal) => input.signalIds?.includes(signal.id))?.siteId
          : this.signals.find((signal) => signal.meterId === input.meterId)?.siteId,
      severity: input.severity ?? "watch",
      score: input.score ?? 0,
      status: "new",
      signalIds: input.signalIds ?? [],
      owner: input.owner,
      notes: input.notes,
      createdAt,
      updatedAt: createdAt,
    };

    this.cases.unshift(newCase);
    if (isSupabaseDbEnabled()) {
      await upsertTheftCaseRecord(newCase);
    }
    await this.persist();
    return newCase;
  }

  public async updateCase(input: {
    id: string;
    status?: TheftCaseStatus;
    owner?: string;
    notes?: string;
  }) {
    const current = this.cases.find((item) => item.id === input.id);
    if (!current) {
      return null;
    }

    if (input.status) {
      current.status = input.status;
      if (["confirmed-theft", "false-positive", "closed"].includes(input.status)) {
        current.closedAt = new Date().toISOString();
      }
    }

    if (input.owner !== undefined) {
      current.owner = input.owner;
    }

    if (input.notes !== undefined) {
      current.notes = input.notes;
    }

    current.updatedAt = new Date().toISOString();
    if (isSupabaseDbEnabled()) {
      await upsertTheftCaseRecord(current);
    }
    await this.persist();
    return current;
  }

  public async addCaseAction(input: {
    id: string;
    action: string;
    actor?: string;
    notes?: string;
  }) {
    const current = this.cases.find((item) => item.id === input.id);
    if (!current) {
      return null;
    }

    const actionText = `${new Date().toISOString()} :: ${input.actor ?? "system"} :: ${input.action}${
      input.notes ? ` :: ${input.notes}` : ""
    }`;
    current.notes = current.notes ? `${current.notes}\n${actionText}` : actionText;
    current.updatedAt = new Date().toISOString();
    if (isSupabaseDbEnabled()) {
      await upsertTheftCaseRecord(current);
    }
    await this.persist();
    return current;
  }
}

export const theftIntelligenceService = new TheftIntelligenceService();
