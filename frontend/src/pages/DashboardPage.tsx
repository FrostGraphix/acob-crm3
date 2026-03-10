import { useEffect, useState } from "react";
import { BarChart } from "../components/charts/BarChart";
import { LineChart } from "../components/charts/LineChart";
import { PieChart } from "../components/charts/PieChart";
import { StatCard } from "../components/common/StatCard";
import { loadDashboard } from "../services/api";
import type { DashboardData } from "../types";

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consumptionMode, setConsumptionMode] = useState<"daily" | "monthly">("daily");

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboard() {
      setLoading(true);
      setError(null);

      try {
        const payload = await loadDashboard();

        if (!cancelled) {
          setDashboard(payload);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "Dashboard failed to load");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <section className="page-stack">Loading dashboard...</section>;
  }

  if (!dashboard) {
    return (
      <section className="page-stack">
        <p className="status-banner status-banner-error">{error ?? "Dashboard unavailable"}</p>
      </section>
    );
  }

  const consumptionValues =
    consumptionMode === "daily" ? dashboard.consumption.daily : dashboard.consumption.monthly;

  return (
    <section className="page-stack">
      <div className="stat-grid">
        {dashboard.panels.map((panel) => (
          <StatCard
            accent={panel.accent}
            key={panel.label}
            label={panel.label}
            value={panel.value}
          />
        ))}
      </div>

      <section className="dashboard-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Purchase Money</p>
            <h2>Weekly transaction flow</h2>
          </div>
        </div>
        <BarChart labels={dashboard.purchaseMoney.labels} values={dashboard.purchaseMoney.values} />
      </section>

      <div className="dashboard-split">
        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Hourly Success Rate</p>
              <h2>Performance through the day</h2>
            </div>
          </div>
          <LineChart labels={dashboard.successRate.labels} values={dashboard.successRate.values} />
        </section>

        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Abnormal Alarm</p>
              <h2>Alarm mix</h2>
            </div>
          </div>
          <PieChart slices={dashboard.alarms} />
        </section>
      </div>

      <section className="dashboard-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Daily Consumption</p>
            <h2>Energy usage trend</h2>
          </div>
          <div className="segmented-control">
            <button
              className={consumptionMode === "daily" ? "button button-primary" : "button button-ghost"}
              onClick={() => setConsumptionMode("daily")}
              type="button"
            >
              Daily
            </button>
            <button
              className={
                consumptionMode === "monthly" ? "button button-primary" : "button button-ghost"
              }
              onClick={() => setConsumptionMode("monthly")}
              type="button"
            >
              Monthly
            </button>
          </div>
        </div>
        <BarChart labels={dashboard.consumption.labels} values={consumptionValues} />
      </section>
    </section>
  );
}
