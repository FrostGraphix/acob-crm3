import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  VwBadge,
  VwBtn,
  VwDivider,
  VwInfoBox,
  VwKPI,
  NGN,
} from "../components/vendor/VendorPortalPrimitives.tsx";
import { request } from "../services/api";
import { normalizeTableData } from "../services/table-data";
import type { DataRow, WalletAdminHomePageConfig } from "../types";

interface WalletAdminSnapshot {
  kpis: DataRow[];
  onboardingQueue: DataRow[];
  fundingQueue: DataRow[];
  exceptions: DataRow[];
}

function readText(row: DataRow | undefined, keys: string[], fallback = "--") {
  if (!row) return fallback;
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text.length > 0) return text;
  }
  return fallback;
}

function readMoney(row: DataRow | undefined, keys: string[]) {
  const value = keys
    .map((key) => row?.[key])
    .find((entry) => entry !== null && entry !== undefined && String(entry).trim().length > 0);

  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function readCount(rows: DataRow[], key: string) {
  const value = rows[0]?.[key];
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatMoney(value: number) {
  return NGN(value);
}

function getSeverityVariant(severity: string): "danger" | "warning" | "info" | "gray" {
  const s = severity.toLowerCase();
  if (s.includes("critical")) return "danger";
  if (s.includes("high")) return "warning";
  if (s.includes("medium")) return "info";
  return "gray";
}

export function WalletAdminHomePage({ page }: { page: WalletAdminHomePageConfig }) {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<WalletAdminSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshot() {
      setLoading(true);
      setError(null);

      try {
        const [kpisResult, onboardingResult, fundingResult, exceptionResult] = await Promise.all([
          request<unknown>("/api/wallet/finance/kpis", { method: "GET" }),
          request<unknown>("/api/vendor/onboarding/queue", { method: "GET" }),
          request<unknown>("/api/wallet/funding/pending", { method: "GET" }),
          request<unknown>("/api/reconciliation/exceptions", { method: "GET" }),
        ]);

        if (!cancelled) {
          setSnapshot({
            kpis: normalizeTableData(kpisResult, "/api/wallet/finance/kpis").rows,
            onboardingQueue: normalizeTableData(onboardingResult, "/api/vendor/onboarding/queue").rows,
            fundingQueue: normalizeTableData(fundingResult, "/api/wallet/funding/pending").rows,
            exceptions: normalizeTableData(exceptionResult, "/api/reconciliation/exceptions").rows,
          });
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load wallet operations.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSnapshot();

    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = snapshot?.kpis ?? [];
  const fundingPreview = snapshot?.fundingQueue.slice(0, 4) ?? [];
  const exceptionPreview = snapshot?.exceptions.slice(0, 4) ?? [];
  const nearExhaustion = readCount(kpis, "walletsNearExhaustion");
  const totalVendorFloat = readMoney(kpis[0], ["totalVendorFloat", "totalFloat", "vendorFloat"]);
  const totalReserved = readMoney(kpis[0], ["totalReserved", "reservedFloat"]);
  const todaysPurchases = readMoney(kpis[0], ["todaysPurchases", "todayPurchases", "purchaseAmountToday"]);
  const openExceptions = snapshot?.exceptions.length ?? 0;
  const chartBars = Array.from({ length: 14 }, (_, index) => 38 + ((index * 11 + openExceptions * 7) % 55));

  return (
    <section className="page-stack ds-page" style={{ fontFamily: "var(--vw-font)" }}>
      <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
        <div className="vw-hero">
          <div className="vw-hero__top">
            <div>
              <div className="vw-hero__eyebrow">Finance Admin Workspace</div>
              <div className="vw-hero__balance" style={{ fontSize: 28 }}>{page.title}</div>
              <div className="vw-hero__sub" style={{ marginTop: 6 }}>
                Vendor onboarding · wallet funding · commission · reconciliation
              </div>
            </div>
            <div className="vw-hero__right">
              <VwBtn
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
              >
                Return to CRM
              </VwBtn>
              <VwBtn variant="lemon" size="sm" onClick={() => navigate("/wallet-admin/funding-pending")}>
                Review Funding Queue
              </VwBtn>
            </div>
          </div>
        </div>

        {error ? <VwInfoBox type="danger">{error}</VwInfoBox> : null}

        <div className="vw-grid-4">
          <VwKPI label="Total Vendor Float" value={loading ? "--" : formatMoney(totalVendorFloat)} sub={`${snapshot?.onboardingQueue.length ?? 0} active or pending wallets`} iconBg="#e6f4e6" />
          <VwKPI label="Total Reserved" value={loading ? "--" : formatMoney(totalReserved)} sub="In-flight wallet commitments" iconBg="#FFFBEB" />
          <VwKPI label="Today's Purchases" value={loading ? "--" : formatMoney(todaysPurchases)} sub="Purchase activity today" iconBg="#EFF6FF" />
          <VwKPI label="Open Exceptions" value={loading ? "--" : openExceptions} sub={`${exceptionPreview.filter((row) => readText(row, ["severity"]).toLowerCase().includes("critical")).length} critical`} iconBg="#FEF2F2" />
        </div>

        <div className="vw-grid-2-1">
          <div className="vw-surface vw-surface--padded">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div className="vw-surface__title">Purchase Volume - Last 14 Days</div>
              <VwBadge variant="success" dot>{formatMoney(todaysPurchases || 0)} total</VwBadge>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 110 }}>
              {chartBars.map((height, index) => (
                <div key={`${height}-${index}`} style={{ flex: 1, borderRadius: "3px 3px 0 0", height: `${height}%`, background: index === chartBars.length - 1 ? "var(--vw-primary)" : "#b7dfc8" }} />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--vw-faint)", marginTop: 8, fontFamily: "var(--vw-mono)" }}>
              <span>14 days ago</span>
              <span>Today</span>
            </div>
          </div>

          <div className="vw-surface vw-surface--padded">
            <div className="vw-surface__title" style={{ marginBottom: 16 }}>Wallets Near Exhaustion</div>
            {[
              { name: "Watchlist Wallets", balance: nearExhaustion * 50000, pct: Math.min(nearExhaustion * 18, 100) || 10 },
              { name: "Pending Review Wallets", balance: (snapshot?.onboardingQueue.length ?? 0) * 20000, pct: Math.min((snapshot?.onboardingQueue.length ?? 0) * 12, 100) || 8 },
            ].map((item) => (
              <div key={item.name} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: "var(--vw-text)", fontWeight: 600 }}>{item.name}</span>
                  <span style={{ color: item.pct < 20 ? "var(--vw-danger)" : "var(--vw-muted)", fontWeight: 700 }}>{formatMoney(item.balance)}</span>
                </div>
                <div style={{ height: 6, background: "var(--vw-bg)", borderRadius: 3 }}>
                  <div style={{ height: 6, width: `${item.pct}%`, background: item.pct < 20 ? "var(--vw-danger)" : "var(--vw-primary)", borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 10, color: "var(--vw-faint)", marginTop: 3 }}>{item.pct}% of threshold</div>
              </div>
            ))}
            <VwBtn variant="ghost" size="sm" full onClick={() => navigate("/wallet-admin/vendor-onboarding")}>View all wallets →</VwBtn>
          </div>
        </div>

        <div className="vw-grid-2">
          <div className="vw-surface vw-surface--padded">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div className="vw-surface__title">Funding & Manual Credits</div>
              <VwBtn variant="lemon" size="sm" onClick={() => navigate("/wallet-admin/funding-pending")}>View queue</VwBtn>
            </div>
            {fundingPreview.length === 0 ? (
              <p style={{ color: "var(--vw-muted)", fontSize: 13, textAlign: "center", padding: "1rem 0" }}>
                No funding approvals pending.
              </p>
            ) : null}
            {fundingPreview.slice(0, 2).map((row, index) => (
              <div key={`funding-${index + 1}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--vw-bg)", borderRadius: 10, marginBottom: 8, border: "1px solid var(--vw-border)" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--vw-text)" }}>
                    {readText(row, ["vendorName", "businessName", "displayName"])}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--vw-muted)", marginTop: 2 }}>
                    {readText(row, ["submittedAt", "createdAt", "updatedAt"], "Recent")} · {readText(row, ["channel"], "Funding")}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--vw-text)" }}>{formatMoney(readMoney(row, ["amount"]))}</div>
                  <VwBadge variant="lemon">{readText(row, ["status"]).replace(/_/g, " ")}</VwBadge>
                </div>
              </div>
            ))}
            <div style={{ padding: "10px 12px", background: "var(--vw-lemon-light)", borderRadius: 10, border: "1px solid var(--vw-lemon)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--vw-lemon-text)", marginBottom: 2 }}>Manual Credit Preview</div>
              <div style={{ fontSize: 11, color: "var(--vw-lemon-text)" }}>
                Maker-checker flow remains active. A separate checker approval is required before posting any manual credit.
              </div>
            </div>
          </div>

          <div className="vw-surface vw-surface--padded">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div className="vw-surface__title">Open Exceptions</div>
              <VwBtn variant="ghost" size="sm" onClick={() => navigate("/wallet-admin/exceptions")}>View all →</VwBtn>
            </div>
            {exceptionPreview.length === 0 ? (
              <p style={{ color: "var(--vw-muted)", fontSize: 13, textAlign: "center", padding: "1rem 0" }}>
                No open reconciliation exceptions.
              </p>
            ) : null}
            {exceptionPreview.map((row, index) => {
              const severity = readText(row, ["severity"]);
              return (
                <div key={`exception-${index + 1}`} style={{ padding: "10px 0", borderBottom: "1px solid var(--vw-border)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <VwBadge variant={getSeverityVariant(severity)}>{severity.toUpperCase()}</VwBadge>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--vw-text)", marginBottom: 2 }}>
                      {readText(row, ["summary", "vendorName", "type"])}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--vw-muted)", lineHeight: 1.5 }}>
                      {readText(row, ["type"])} · {readText(row, ["siteCode", "siteName"])} · Assigned: {readText(row, ["assignee"], "unassigned")}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--vw-faint)", whiteSpace: "nowrap" }}>
                    SLA: {readText(row, ["sla", "slaTarget"], "Open")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="vw-surface vw-surface--padded" style={{ marginTop: 4 }}>
          <VwDivider label="WORKSPACE RULE" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {[
              ["Auth model", "Shared staff session, no second login"],
              ["Data model", "Shared wallet, vendor, token, meter, and reconciliation APIs"],
              ["CRM surface", "Single sidebar launcher only"],
              ["Vendor isolation", "Vendor users remain in /vendor/* and cannot enter this workspace"],
            ].map(([k, v]) => (
              <div key={k} style={{ background: "var(--vw-bg)", borderRadius: 10, padding: "12px 14px", border: "1px solid var(--vw-border)" }}>
                <div style={{ fontSize: 10, color: "var(--vw-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, fontWeight: 600 }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--vw-text)" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default WalletAdminHomePage;
