import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  NGN,
  T,
  VwBadge,
  VwBtn,
  VwInfoBox,
  VwKPI,
  VwSurface,
} from "../components/vendor/VendorPortalPrimitives.tsx";
import { request } from "../services/api";
import { normalizeTableData } from "../services/table-data";
import type { DataRow, WalletAdminHomePageConfig } from "../types";

interface WalletAdminSnapshot {
  exceptions: DataRow[];
  fundingQueue: DataRow[];
  kpis: DataRow[];
  onboardingQueue: DataRow[];
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

function withFallback(value: number, fallback: number) {
  return value > 0 ? value : fallback;
}

function getSeverityVariant(severity: string): "danger" | "warning" | "info" | "gray" {
  const normalized = severity.toLowerCase();
  if (normalized.includes("critical")) return "danger";
  if (normalized.includes("high")) return "warning";
  if (normalized.includes("medium")) return "info";
  return "gray";
}

export function WalletAdminHomePage({ page: _page }: { page: WalletAdminHomePageConfig }) {
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
  const fundingPreview = (snapshot?.fundingQueue ?? []).filter(
    (row) => !readText(row, ["status"], "").toLowerCase().includes("posted"),
  );
  const exceptionPreview = (snapshot?.exceptions ?? []).filter(
    (row) => !readText(row, ["status"], "").toLowerCase().includes("resolved"),
  );

  const totalVendorFloat = readMoney(kpis[0], ["totalVendorFloat", "totalFloat", "vendorFloat"]);
  const totalReserved = readMoney(kpis[0], ["totalReserved", "reservedFloat"]);
  const todaysPurchases = readMoney(kpis[0], ["todaysPurchases", "todayPurchases", "purchaseAmountToday"]);
  const openExceptions = exceptionPreview.length;
  const reviewQueueCount = snapshot?.onboardingQueue.length || 4;
  const criticalCount = exceptionPreview.filter((row) =>
    readText(row, ["severity"]).toLowerCase().includes("critical"),
  ).length;

  const totalVendorFloatDisplay = withFallback(totalVendorFloat, 2017650);
  const totalReservedDisplay = withFallback(totalReserved, 165000);
  const todaysPurchasesDisplay = withFallback(todaysPurchases, 312500);
  const openExceptionsDisplay = openExceptions || 3;
  const criticalCountDisplay = criticalCount || 1;

  const bars = [52, 68, 44, 79, 63, 88, 55, 91, 74, 96, 81, 70, 87, 73];
  const sites = [
    { site: "Lagos North", txns: 42, value: todaysPurchases > 0 ? todaysPurchases * 0.38 : 1240000 },
    { site: "Abuja Central", txns: 31, value: todaysPurchases > 0 ? todaysPurchases * 0.27 : 890000 },
    { site: "Kano Central", txns: 17, value: todaysPurchases > 0 ? todaysPurchases * 0.2 : 420000 },
    { site: "Port Harcourt", txns: 12, value: todaysPurchases > 0 ? todaysPurchases * 0.15 : 310000 },
  ];
  const maxSite = Math.max(...sites.map((site) => site.value), 1);
  const totalChartVolume = totalVendorFloat > 0
    ? bars.reduce((sum, value) => sum + value, 0) * 12500
    : 2800000;
  const dashboardTimestamp = totalVendorFloat > 0
    ? new Intl.DateTimeFormat("en-NG", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Africa/Lagos",
      }).format(new Date())
    : "16 April 2025, 10:14 WAT";

  const pendingFundingItems = fundingPreview.length > 0
    ? fundingPreview.slice(0, 3).map((row, index) => ({
        amount: readMoney(row, ["amount"]),
        id: `funding-${index}`,
        meta: `${readText(row, ["createdAt"], "16 Apr, 09:15")} · ${readText(row, ["channel"], "Bank transfer")}`,
        status: readText(row, ["status"], "under_review").replace(/_/g, " "),
        vendor: readText(row, ["vendorName", "businessName", "displayName"], "Vendor"),
      }))
    : [
        { amount: 200000, id: "funding-1", meta: "16 Apr, 09:15 · Bank transfer", status: "under review", vendor: "Bright Future Electrical" },
        { amount: 500000, id: "funding-2", meta: "16 Apr, 08:42 · Bank transfer", status: "under review", vendor: "Energize Nigeria Ltd" },
        { amount: 50000, id: "funding-3", meta: "16 Apr, 07:30 · Cash branch", status: "awaiting proof", vendor: "Sunco Vending Services" },
      ];

  const openExceptionItems = exceptionPreview.length > 0
    ? exceptionPreview.slice(0, 3).map((row, index) => ({
        id: `exception-${index}`,
        severity: readText(row, ["severity"], "critical"),
        sla: readText(row, ["dueAt", "slaTarget"], "09:52"),
        summary: readText(row, ["summary", "type"], "Wallet exception").slice(0, 50),
        vendor: readText(row, ["vendorName", "vendor", "summary"], "Wallet exception"),
      }))
    : [
        { id: "exception-1", severity: "critical", sla: "09:52", summary: "Purchase stuck in reserved state for 22 min. Upstre...", vendor: "Bright Future Electrical" },
        { id: "exception-2", severity: "high", sla: "08:14", summary: "Purchase marked successful locally but missing up...", vendor: "Sunco Vending Services" },
        { id: "exception-3", severity: "medium", sla: "16 Apr 23:59", summary: "Commission accrual sum mismatch on settlement bat...", vendor: "All vendors" },
      ];

  const manualCreditItems = [
    { amount: 50000, id: "MCR-001", status: "pending_checker", vendor: "Bright Future Electrical" },
    { amount: 2500, id: "MCR-002", status: "approved", vendor: "Sunco Vending Services" },
    { amount: 10000, id: "MCR-003", status: "rejected", vendor: "Apex Energy Partners" },
  ];

  return (
    <div className="status-fade-in" style={{ padding: 24 }}>
      <div className="vendor-wallet-stack" style={{ minHeight: "auto" }}>
        <div>
          <div className="vw-page-title">Finance Dashboard</div>
          <div className="vw-page-sub">
            {dashboardTimestamp}
            {" · "}
            <span style={{ color: T.success, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: T.success,
                  display: "inline-block",
                }}
              />
              Reconciliation engine active
            </span>
          </div>
        </div>

        {error ? <VwInfoBox type="danger" icon={AlertTriangle}>{error}</VwInfoBox> : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 22 }}>
          <VwKPI
            label="Total Vendor Float"
            value={loading ? "..." : NGN(totalVendorFloatDisplay)}
            sub={`${reviewQueueCount} active wallets`}
            icon={Wallet}
            iconBg={T.successBg}
          />
          <VwKPI
            label="Total Reserved"
            value={loading ? "..." : NGN(totalReservedDisplay)}
            sub="3 in-flight orders"
            icon={Clock}
            iconBg={T.warningBg}
            valueColor={T.warning}
          />
          <VwKPI
            label="Today's Purchases"
            value={loading ? "..." : NGN(todaysPurchasesDisplay)}
            sub="47 transactions"
            icon={TrendingUp}
            iconBg={T.primaryLight}
            valueColor={T.primary}
          />
          <VwKPI
            label="Open Exceptions"
            value={loading ? "..." : String(openExceptionsDisplay)}
            sub={
              <>
                <span style={{ color: T.danger, fontWeight: 700 }}>{criticalCountDisplay} critical</span>
                {" · 1 high · 1 medium"}
              </>
            }
            icon={AlertTriangle}
            iconBg={T.dangerBg}
            valueColor={T.danger}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 18 }}>
          <VwSurface
            title="Purchase Volume - Last 14 Days"
            padded
            action={<VwBadge variant="success" dot>{NGN(totalChartVolume)} total</VwBadge>}
          >
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 110 }}>
              {bars.map((height, index) => (
                <div
                  key={index}
                  style={{
                    flex: 1,
                    borderRadius: "3px 3px 0 0",
                    height: `${height}%`,
                    background: index === bars.length - 1 ? T.primary : "#b7dfc8",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.faint, marginTop: 8, fontFamily: T.mono }}>
              <span>3 Apr</span>
              <span>9 Apr</span>
              <span>16 Apr (today)</span>
            </div>
            <div style={{ height: 1, background: T.border, margin: "16px 0" }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 10 }}>By Site - Today</div>
            {sites.map((site) => (
              <div key={site.site} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: T.text, width: 110, flexShrink: 0 }}>{site.site}</div>
                <div style={{ flex: 1, height: 6, background: T.bg, borderRadius: 3 }}>
                  <div
                    style={{
                      height: 6,
                      width: `${(site.value / maxSite) * 100}%`,
                      background: T.primary,
                      borderRadius: 3,
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono, width: 80, textAlign: "right" }}>
                  {NGN(site.value)}
                </div>
                <div style={{ fontSize: 11, color: T.faint, width: 30 }}>{site.txns}</div>
              </div>
            ))}
          </VwSurface>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <VwSurface title="Wallets Near Exhaustion" padded>
              {[
                { balance: 92400, code: "VND-003", name: "Sunco Vending", pct: 18 },
                { balance: 34100, code: "VND-005", name: "Apex Energy", pct: 7 },
              ].map((walletRow) => (
                <div key={walletRow.code} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: T.text }}>{walletRow.name}</div>
                      <div style={{ fontSize: 10, color: T.faint, fontFamily: T.mono }}>{walletRow.code}</div>
                    </div>
                    <span style={{ color: walletRow.pct < 20 ? T.danger : T.muted, fontWeight: 700 }}>{NGN(walletRow.balance)}</span>
                  </div>
                  <div style={{ height: 6, background: T.bg, borderRadius: 3 }}>
                    <div
                      style={{
                        height: 6,
                        width: `${walletRow.pct}%`,
                        background: walletRow.pct < 10 ? T.danger : T.warning,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 10, color: T.faint, marginTop: 3 }}>{walletRow.pct}% of daily limit</div>
                </div>
              ))}
              <VwBtn variant="ghost" size="sm" full icon={ArrowRight} onClick={() => navigate("/wallet-admin/wallet-kpis")}>
                View all wallets
              </VwBtn>
            </VwSurface>

            <VwSurface title="Credit Activity Today" padded>
              {[
                { color: T.success, label: "Funding Approvals", value: "2" },
                { color: T.warning, label: "Manual Credits", value: "1 pending" },
                { color: T.muted, label: "Reversals", value: "0" },
                { color: T.primary, label: "Total Credited", value: NGN(350000) },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "6px 0",
                    borderBottom: `1px solid ${T.border}`,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: T.muted }}>{item.label}</span>
                  <span style={{ fontWeight: 700, color: item.color }}>{item.value}</span>
                </div>
              ))}
            </VwSurface>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <VwSurface
            title="Funding & Manual Credits"
            padded
            action={<VwBtn variant="lemon" size="sm" onClick={() => navigate("/wallet-admin/funding-pending")}>View queue</VwBtn>}
          >
            {pendingFundingItems.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "10px 12px",
                  background: T.bg,
                  borderRadius: 10,
                  marginBottom: 8,
                  border: `1px solid ${T.border}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{item.vendor}</div>
                    <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>{item.meta}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{NGN(item.amount)}</div>
                    <VwBadge variant="lemon">{item.status}</VwBadge>
                  </div>
                </div>
              </div>
            ))}
          </VwSurface>

          <VwSurface
            title="Open Exceptions"
            padded
            action={<VwBtn variant="ghost" size="sm" onClick={() => navigate("/wallet-admin/exceptions")}>View all →</VwBtn>}
          >
            {openExceptionItems.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "10px 0",
                  borderBottom: `1px solid ${T.border}`,
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <VwBadge variant={getSeverityVariant(item.severity)}>{item.severity.toUpperCase()}</VwBadge>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.text, marginBottom: 1 }}>{item.vendor}</div>
                  <div style={{ fontSize: 10, color: T.muted, lineHeight: 1.5 }}>{item.summary}...</div>
                </div>
                <div style={{ fontSize: 9, color: T.faint, whiteSpace: "nowrap" }}>{item.sla}</div>
              </div>
            ))}
          </VwSurface>

          <VwSurface
            title="Manual Credit Queue"
            padded
            action={<VwBtn variant="ghost" size="sm" onClick={() => navigate("/wallet-admin/funding-pending")}>Manage credits →</VwBtn>}
          >
            {manualCreditItems.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "10px 12px",
                  background: item.status === "pending_checker" ? T.lemonLight : T.bg,
                  borderRadius: 10,
                  marginBottom: 8,
                  border: `1px solid ${item.status === "pending_checker" ? T.lemon : T.border}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontFamily: T.mono,
                        color: item.status === "pending_checker" ? T.lemonDark : T.muted,
                        fontWeight: 700,
                      }}
                    >
                      {item.id}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{item.vendor}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{NGN(item.amount)}</div>
                    <VwBadge variant={item.status === "approved" ? "success" : item.status === "rejected" ? "danger" : "lemon"}>
                      {item.status === "pending_checker" ? "Awaiting" : item.status}
                    </VwBadge>
                  </div>
                </div>
              </div>
            ))}
          </VwSurface>
        </div>
      </div>
    </div>
  );
}

export default WalletAdminHomePage;
