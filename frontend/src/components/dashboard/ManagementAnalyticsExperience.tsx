import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { pagesByPath } from "../../config/pageCatalog";
import { DualConsumptionChart } from "../charts/DualConsumptionChart";
import {
  loadManagementConsumption,
  loadManagementMeterConsumption,
  type ManagementConsumptionResponse,
  type ManagementMeterConsumptionResponse,
} from "../../services/management-analytics";

type AnalyticsVariant = "dashboard" | "management";

interface AnalyticsTabConfig {
  path: string;
  label: string;
  icon: () => ReactNode;
}

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <IconBase>
      <path d="M4 18h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 16V9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 16V6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 16v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  );
}

function GatewayIcon() {
  return (
    <IconBase>
      <rect x="6" y="8" width="12" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 18h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 5a4 4 0 0 1 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 3a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
    </IconBase>
  );
}

function MeterIcon() {
  return (
    <IconBase>
      <rect x="5" y="5" width="14" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 9h6v6H9z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </IconBase>
  );
}

function CustomerIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="8.5" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 18.5a6.5 6.5 0 0 1 13 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  );
}

function TariffIcon() {
  return (
    <IconBase>
      <path d="M12 4v16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.6 2.5 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function AccountIcon() {
  return (
    <IconBase>
      <path d="M12 3l7 3v5c0 4.5-2.7 7.4-7 10-4.3-2.6-7-5.5-7-10V6l7-3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </IconBase>
  );
}

function ZapIcon() {
  return (
    <IconBase>
      <path d="M13 2L5 13h5l-1 9 8-11h-5l1-9z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </IconBase>
  );
}

function SunIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </IconBase>
  );
}

function MoonIcon() {
  return (
    <IconBase>
      <path d="M18 14.5A6.8 6.8 0 0 1 9.5 6a7.6 7.6 0 1 0 8.5 8.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function RevenueIcon() {
  return (
    <IconBase>
      <path d="M6 16l4-4 3 3 5-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 9h4v4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

const dashboardTabsConfig = [
  { path: "/dashboard", label: "Analytics", icon: AnalyticsIcon },
  { path: "/management/gateway", label: "Gateways", icon: GatewayIcon },
  { path: "/management/meter", label: "Meters", icon: MeterIcon },
  { path: "/management/customer", label: "Customers", icon: CustomerIcon },
  { path: "/management/tariff", label: "Tariffs", icon: TariffIcon },
  { path: "/management/account", label: "Accounts", icon: AccountIcon },
] as const satisfies readonly AnalyticsTabConfig[];

const managementTabsConfig = [
  { path: "/management/analytics", label: "Analytics", icon: AnalyticsIcon },
  { path: "/management/gateway", label: "Gateways", icon: GatewayIcon },
  { path: "/management/meter", label: "Meters", icon: MeterIcon },
  { path: "/management/customer", label: "Customers", icon: CustomerIcon },
  { path: "/management/tariff", label: "Tariffs", icon: TariffIcon },
  { path: "/management/account", label: "Accounts", icon: AccountIcon },
] as const satisfies readonly AnalyticsTabConfig[];

const variantCopy: Record<
  AnalyticsVariant,
  {
    activePath: string;
    badge: string;
    description: string;
    eyebrow: string;
    title: string;
    tabs: readonly AnalyticsTabConfig[];
  }
> = {
  dashboard: {
    activePath: "/dashboard",
    badge: "Analytics",
    description: "Robust data trends and site-wide energy consumption analysis.",
    eyebrow: "Portfolio Workspace",
    title: "Analytics",
    tabs: dashboardTabsConfig,
  },
  management: {
    activePath: "/management/analytics",
    badge: "Analytics",
    description: "Robust data trends and site-wide energy consumption analysis.",
    eyebrow: "Admin Workspace",
    title: "Management",
    tabs: managementTabsConfig,
  },
};

function formatPercent(value: number | null) {
  if (value == null) {
    return "--";
  }

  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}

function formatCompactKwh(value: number | null) {
  if (value == null) {
    return "--";
  }

  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toLocaleString("en-US", {
      maximumFractionDigits: 2,
    })} MWh`;
  }

  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} kWh`;
}

function formatEnergyForTable(value: number | null) {
  if (value == null) {
    return "--";
  }

  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} MWh`;
  }

  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: value >= 100 ? 0 : 1,
    maximumFractionDigits: 1,
  })} kWh`;
}

function formatCurrency(value: number | null) {
  if (value == null) {
    return "--";
  }

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateLabel(value: string | null) {
  if (!value) {
    return "--";
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(parsed);
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20 11a8 8 0 1 0 2 5.29"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M20 4v7h-7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ConsumersSectionIcon() {
  return (
    <span className="management-section-icon" aria-hidden="true">
      <ZapIcon />
    </span>
  );
}

function KpiIcon({ kind }: { kind: "energy" | "day" | "night" | "revenue" }) {
  const iconMap = {
    energy: { icon: ZapIcon, className: "management-kpi-icon--green" },
    day: { icon: SunIcon, className: "management-kpi-icon--amber" },
    night: { icon: MoonIcon, className: "management-kpi-icon--emerald" },
    revenue: { icon: RevenueIcon, className: "management-kpi-icon--mint" },
  } as const;

  const entry = iconMap[kind];
  const Icon = entry.icon;
  return (
    <span className={`management-kpi-icon ${entry.className}`} aria-hidden="true">
      <Icon />
    </span>
  );
}

export function ManagementAnalyticsExperience({ variant }: { variant: AnalyticsVariant }) {
  const navigate = useNavigate();
  const config = variantCopy[variant];
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [consumption, setConsumption] = useState<ManagementConsumptionResponse | null>(null);
  const [meterConsumption, setMeterConsumption] = useState<ManagementMeterConsumptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meterError, setMeterError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      setMeterError(null);
      const firstLoad = !hasLoadedOnceRef.current;
      setLoading(firstLoad);
      setRefreshing(!firstLoad);

      try {
        const [consumptionResult, meterResult] = await Promise.allSettled([
          loadManagementConsumption(selectedSite || null),
          loadManagementMeterConsumption(selectedSite || null, 10),
        ]);

        if (!cancelled) {
          if (consumptionResult.status === "fulfilled") {
            setConsumption(consumptionResult.value);
            hasLoadedOnceRef.current = true;
          } else {
            setConsumption(null);
          }

          if (meterResult.status === "fulfilled") {
            setMeterConsumption(meterResult.value);
          } else {
            setMeterConsumption(null);
            setMeterError(
              meterResult.reason instanceof Error
                ? meterResult.reason.message
                : "Meter ranking is unavailable right now.",
            );
          }

          if (consumptionResult.status === "rejected") {
            setError(
              consumptionResult.reason instanceof Error
                ? consumptionResult.reason.message
                : "Failed to load management analytics.",
            );
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [refreshVersion, selectedSite]);

  const availableSites = useMemo(() => {
    const sites = new Set<string>();
    for (const site of consumption?.availableSites ?? []) {
      sites.add(site);
    }
    for (const site of meterConsumption?.availableSites ?? []) {
      sites.add(site);
    }
    return Array.from(sites);
  }, [consumption?.availableSites, meterConsumption?.availableSites]);

  const tabs = useMemo(
    () => config.tabs.filter((tab) => Boolean(pagesByPath[tab.path])),
    [config.tabs],
  );
  const summary = consumption?.summary ?? null;

  return (
    <section className="management-analytics-page crm2-management-page ds-page">
      <header className="management-analytics-hero">
        <div className="management-analytics-hero-copy">
          <span className="site-report-eyebrow">{config.eyebrow}</span>
          <h1 className="management-analytics-title">{config.title}</h1>
          <p className="management-analytics-description">{config.description}</p>
        </div>
        <span className="crm2-management-badge">{config.badge}</span>
      </header>

      <div className="premium-card management-analytics-tabs">
        <div className="management-analytics-tab-list" role="tablist" aria-label="Analytics sections">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.path}
                className={`management-analytics-tab ${tab.path === config.activePath ? "is-active" : ""}`}
                onClick={() => navigate(tab.path)}
                type="button"
              >
                <span className="management-analytics-tab-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="management-analytics-toolbar">
        <label className="site-report-field management-analytics-filter">
          <span className="management-analytics-toolbar-label">Site filter</span>
          <select
            aria-label="Filter analytics by site"
            value={selectedSite}
            onChange={(event) => setSelectedSite(event.target.value)}
          >
            <option value="">All Sites</option>
            {availableSites.map((site) => (
              <option key={site} value={site}>
                {site}
              </option>
            ))}
          </select>
        </label>

        <button
          aria-label={refreshing ? "Refreshing analytics" : "Refresh analytics"}
          className="button button-ghost management-analytics-refresh"
          onClick={() => setRefreshVersion((current) => current + 1)}
          type="button"
        >
          <RefreshIcon />
        </button>
      </div>

      {error ? <p className="status-banner status-banner-error">{error}</p> : null}
      {meterError ? <p className="status-banner">{meterError}</p> : null}
      {consumption?.issues.length ? <p className="status-banner">{consumption.issues.join(" ")}</p> : null}

      <div className="management-analytics-kpi-grid">
        <article className="premium-card management-kpi management-kpi--green">
          <div className="management-kpi-topline">
            <span className="management-kpi-label">Total Energy</span>
            <KpiIcon kind="energy" />
          </div>
          <strong className="management-kpi-value">
            {formatCompactKwh(summary?.totalConsumptionKwh ?? null)}
          </strong>
        </article>

        <article className="premium-card management-kpi management-kpi--amber">
          <div className="management-kpi-topline">
            <span className="management-kpi-label">Day Usage (6AM-6PM)</span>
            <KpiIcon kind="day" />
          </div>
          <strong className="management-kpi-value management-kpi-value--stacked crm2-management-kpi-value">
            {`${formatCompactKwh(summary?.totalDayKwh ?? null)} (${formatPercent(summary?.percentDay ?? null)})`}
          </strong>
        </article>

        <article className="premium-card management-kpi management-kpi--emerald">
          <div className="management-kpi-topline">
            <span className="management-kpi-label">Night Usage (6PM-6AM)</span>
            <KpiIcon kind="night" />
          </div>
          <strong className="management-kpi-value management-kpi-value--stacked crm2-management-kpi-value">
            {`${formatCompactKwh(summary?.totalNightKwh ?? null)} (${formatPercent(summary?.percentNight ?? null)})`}
          </strong>
        </article>

        <article className="premium-card management-kpi management-kpi--mint">
          <div className="management-kpi-topline">
            <span className="management-kpi-label">Total Revenue</span>
            <KpiIcon kind="revenue" />
          </div>
          <strong className="management-kpi-value">
            {formatCurrency(summary?.totalRevenue ?? null)}
          </strong>
        </article>
      </div>

      {loading && !consumption ? (
        <section className="premium-chart-card management-analytics-chart-card crm2-management-chart-card">
          <div className="chart-header">
            <h3 className="chart-title management-panel-title">
              <span className="management-section-icon management-section-icon--green" aria-hidden="true">
                <AnalyticsIcon />
              </span>
              <span>Day vs Night Energy Consumption Trends</span>
            </h3>
          </div>
          <div className="crm2-management-chart-loading" />
        </section>
      ) : consumption && consumption.trend.labels.length > 0 ? (
        <DualConsumptionChart
          className="management-analytics-chart-card crm2-management-chart-card"
          labels={consumption.trend.labels}
          dayValues={consumption.trend.dayValues}
          nightValues={consumption.trend.nightValues}
          title="Day vs Night Energy Consumption Trends"
          dayLabel="Day kWh"
          nightLabel="Night kWh"
          height={360}
        />
      ) : (
        <section className="premium-chart-card management-analytics-chart-card crm2-management-chart-card">
          <div className="chart-header">
            <h3 className="chart-title management-panel-title">
              <span className="management-section-icon management-section-icon--green" aria-hidden="true">
                <AnalyticsIcon />
              </span>
              <span>Day vs Night Energy Consumption Trends</span>
            </h3>
          </div>
          <div className="site-report-empty">No historical consumption data found.</div>
        </section>
      )}

      <section className="premium-card management-analytics-table-card crm2-management-table-card">
        <div className="chart-header crm2-management-table-header">
          <div>
            <h3 className="chart-title management-panel-title">
              <ConsumersSectionIcon />
              <span>Top Consumers</span>
            </h3>
            <span className="site-consumption-note">
              Ranked from the latest meter consumption snapshot
              {meterConsumption?.snapshotDate
                ? ` for ${formatDateLabel(meterConsumption.snapshotDate)}`
                : ""}
              .
            </span>
          </div>
        </div>

        <div className="management-analytics-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Meter SN</th>
                <th>Customer</th>
                <th>Site</th>
                <th className="cell-align-end">Day kWh</th>
                <th className="cell-align-end">Night kWh</th>
                <th className="cell-align-end">Total kWh</th>
                <th className="cell-align-end">% Day</th>
              </tr>
            </thead>
            <tbody>
              {loading && !meterConsumption ? (
                <tr>
                  <td className="table-empty" colSpan={7}>
                    Loading ranked meter data...
                  </td>
                </tr>
              ) : meterConsumption?.rows.length ? (
                meterConsumption.rows.map((row) => (
                  <tr key={`${row.meterId}-${row.site}`}>
                    <td className="management-analytics-meter" data-label="Meter SN">{row.meterId || "--"}</td>
                    <td className="management-analytics-customer" data-label="Customer">{row.customerName || "--"}</td>
                    <td className="management-analytics-site" data-label="Site">{row.site || "--"}</td>
                    <td className="cell-align-end management-analytics-day-value" data-label="Day kWh">{formatEnergyForTable(row.dayKwh)}</td>
                    <td className="cell-align-end management-analytics-night-value" data-label="Night kWh">{formatEnergyForTable(row.nightKwh)}</td>
                    <td className="cell-align-end management-analytics-total-value" data-label="Total kWh">{formatEnergyForTable(row.totalKwh)}</td>
                    <td className="cell-align-end management-analytics-share-cell" data-label="% Day">
                      <span>{formatPercent(row.percentDay)}</span>
                      <span className="management-analytics-share-bar">
                        <span style={{ width: `${row.percentDay}%` }} />
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="table-empty" colSpan={7}>
                    No ranked meter data is available for the current scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
