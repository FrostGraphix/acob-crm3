import { useEffect, useState, type ReactNode } from "react";
import { BarChart } from "../components/charts/BarChart";
import { LineChart } from "../components/charts/LineChart";
import { PieChart } from "../components/charts/PieChart";
import { loadDashboard } from "../services/api";
import type { DashboardData, PieSlice } from "../types";

function PremiumStatCard({
  label,
  value,
  subtext,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: ReactNode;
  accent: "emerald" | "sapphire" | "amber" | "amethyst";
}) {
  return (
    <div className="premium-card">
      <div className="stat-content">
        <div className="stat-info">
          <span className="stat-label-tiny">{label}</span>
          <strong className="stat-value-huge">{value}</strong>
          {subtext ? <span className="stat-subtext">{subtext}</span> : null}
        </div>
        <div className={`stat-icon-square ${accent}`}>{icon}</div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="premium-chart-card">
      <div className="chart-header">
        <h3 className="chart-title">{title}</h3>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{description}</span>
      </div>
      {children}
    </div>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div
      style={{
        minHeight: "300px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        textAlign: "center",
        padding: "2rem",
        borderRadius: "1rem",
        border: "1px dashed var(--border-subtle)",
        background: "rgba(255, 255, 255, 0.02)",
      }}
    >
      {message}
    </div>
  );
}

function StatIcon({ accent }: { accent: "emerald" | "sapphire" | "amber" | "amethyst" }) {
  switch (accent) {
    case "emerald":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19V5M8 19V9M12 19V12M16 19V7M20 19V3" />
        </svg>
      );
    case "sapphire":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    case "amber":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 2 22h20L12 2z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "amethyst":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      );
  }
}

function countAlarmSlices(slices: PieSlice[]) {
  return slices.reduce((sum, slice) => sum + slice.value, 0);
}

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }

    try {
      const payload = await loadDashboard();
      setDashboard(payload);
    } catch (error) {
      console.error(error);
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void fetchDashboard();
    const interval = setInterval(() => void fetchDashboard(true), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !dashboard) {
    return (
      <div
        className="loading-screen"
        style={{
          color: "var(--acob-green)",
          background: "var(--bg-app)",
          minHeight: "100vh",
        }}
      >
        <p style={{ fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Loading live dashboard data...
        </p>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  const hasPurchaseMoney = dashboard.purchaseMoney.labels.length > 0 && dashboard.purchaseMoney.values.length > 0;
  const hasSuccessRate = dashboard.successRate.labels.length > 0 && dashboard.successRate.values.length > 0;
  const hasAlarms = dashboard.alarms.length > 0;
  const hasDailyConsumption = dashboard.consumption.daily.length > 0;
  const hasMonthlyConsumption = dashboard.consumption.monthly.length > 0;

  const panelAccents: Array<"emerald" | "sapphire" | "amethyst" | "amber"> = [
    "emerald",
    "sapphire",
    "amethyst",
    "amber",
  ];

  return (
    <div className="premium-dashboard">
      <div className="premium-stat-grid">
        {dashboard.panels.map((panel, index) => (
          <PremiumStatCard
            key={panel.label}
            label={panel.label}
            value={panel.value}
            subtext="Live upstream summary"
            accent={panelAccents[index % panelAccents.length]}
            icon={<StatIcon accent={panelAccents[index % panelAccents.length]} />}
          />
        ))}
      </div>

      <div className="premium-chart-grid">
        <ChartCard title="Purchase Money" description="Upstream chart series">
          {hasPurchaseMoney ? (
            <BarChart labels={dashboard.purchaseMoney.labels} values={dashboard.purchaseMoney.values} />
          ) : (
            <EmptyChartState message="No purchase money series was returned by the upstream API." />
          )}
        </ChartCard>

        <ChartCard title="Hourly Success Rate" description="Upstream chart series">
          {hasSuccessRate ? (
            <LineChart labels={dashboard.successRate.labels} values={dashboard.successRate.values} />
          ) : (
            <EmptyChartState message="No success rate series was returned by the upstream API." />
          )}
        </ChartCard>
      </div>

      <div className="premium-chart-grid" style={{ marginTop: "1rem" }}>
        <ChartCard
          title="Abnormal Alarm"
          description={hasAlarms ? `${countAlarmSlices(dashboard.alarms)} total alarm events` : "Upstream alarm distribution"}
        >
          {hasAlarms ? (
            <PieChart slices={dashboard.alarms} />
          ) : (
            <EmptyChartState message="No alarm breakdown was returned by the upstream API." />
          )}
        </ChartCard>

        <ChartCard title="Consumption Trends" description="Daily and monthly upstream series">
          <div style={{ display: "grid", gap: "1rem" }}>
            <section>
              <div className="chart-header" style={{ marginBottom: "0.75rem" }}>
                <h4 className="chart-title" style={{ fontSize: "1rem" }}>
                  Daily Consumption
                </h4>
              </div>
              {hasDailyConsumption ? (
                <BarChart labels={dashboard.consumption.labels} values={dashboard.consumption.daily} />
              ) : (
                <EmptyChartState message="No daily consumption series was returned by the upstream API." />
              )}
            </section>

            <section>
              <div className="chart-header" style={{ marginBottom: "0.75rem" }}>
                <h4 className="chart-title" style={{ fontSize: "1rem" }}>
                  Monthly Consumption
                </h4>
              </div>
              {hasMonthlyConsumption ? (
                <LineChart labels={dashboard.consumption.labels} values={dashboard.consumption.monthly} />
              ) : (
                <EmptyChartState message="No monthly consumption series was returned by the upstream API." />
              )}
            </section>
          </div>
        </ChartCard>
      </div>

      <div className="premium-card" style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 className="chart-title">Live Status</h3>
          <span style={{ color: "var(--emerald)", fontSize: "0.75rem", fontWeight: 600 }}>UPSTREAM ONLY</span>
        </div>
        <p style={{ margin: 0, color: "var(--text-muted)", lineHeight: 1.6 }}>
          This dashboard now reflects only data returned by the upstream API. If a section is empty, the upstream service did not expose that series yet.
        </p>
      </div>
    </div>
  );
}
