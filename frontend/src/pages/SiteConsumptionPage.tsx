import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SiteConsumptionChart } from "../components/charts/SiteConsumptionChart";
import {
  SITE_CONSUMPTION_SITES,
  loadSiteConsumptionSnapshot,
  triggerSiteConsumptionRefresh,
  type SiteConsumptionPageSnapshot,
} from "../services/site-consumption";

const statAccents = ["orange", "blue", "teal", "green"] as const;

function createEmptySnapshot(): SiteConsumptionPageSnapshot {
  return {
    lastUpdatedAt: null,
    summary: SITE_CONSUMPTION_SITES.map((site) => ({
      site,
      totalConsumption: 0,
    })),
    daily: {
      labels: [],
      series: SITE_CONSUMPTION_SITES.map((site) => ({ site, values: [] })),
    },
    monthly: {
      labels: [],
      series: SITE_CONSUMPTION_SITES.map((site) => ({ site, values: [] })),
    },
    yearly: {
      labels: [],
      series: SITE_CONSUMPTION_SITES.map((site) => ({ site, values: [] })),
    },
    status: null,
    errors: [],
  };
}

function formatUpdatedAt(value: string | null) {
  if (!value) {
    return "Awaiting first snapshot";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function SiteConsumptionPage() {
  const navigate = useNavigate();
  const hasTriggeredInitialRefresh = useRef(false);
  const [snapshot, setSnapshot] = useState(createEmptySnapshot);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  async function handleRefreshNow() {
    setRefreshing(true);
    try {
      await triggerSiteConsumptionRefresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to trigger site consumption refresh",
      );
    } finally {
      setRefreshTick((current) => current + 1);
    }
  }

  useEffect(() => {
    if (hasTriggeredInitialRefresh.current) {
      return;
    }

    hasTriggeredInitialRefresh.current = true;
    let cancelled = false;

    async function triggerInitialRefresh() {
      setRefreshing(true);

      try {
        await triggerSiteConsumptionRefresh();
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Failed to trigger site consumption refresh",
          );
        }
      } finally {
        if (!cancelled) {
          setRefreshTick((current) => current + 1);
        }
      }
    }

    void triggerInitialRefresh();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load(background = false) {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const next = await loadSiteConsumptionSnapshot();
        if (!cancelled) {
          setSnapshot(next);
          setError(next.errors[0] ?? null);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "Failed to load site consumption");
          setSnapshot(createEmptySnapshot());
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void load(false);

    const interval = window.setInterval(() => {
      void load(true);
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [refreshTick]);

  const lastUpdatedAt = snapshot.status?.lastUpdatedAt ?? snapshot.lastUpdatedAt;
  const freshnessLabel = loading
    ? "Loading site snapshot"
    : snapshot.status?.inProgress
    ? "Snapshot refresh in progress"
    : refreshing
      ? "Refreshing site snapshot"
      : `Last synced ${formatUpdatedAt(lastUpdatedAt)}`;

  return (
    <div className="premium-dashboard site-consumption-shell">
      <section className="premium-card site-consumption-hero">
        <div className="site-consumption-hero-copy">
          <span className="site-consumption-eyebrow">Dedicated Analytics</span>
          <h1 className="site-consumption-title">Site Consumption</h1>
          <p className="site-consumption-description">
            Live snapshot cards and trend sections for the five sites, backed by dedicated site-consumption endpoints instead of the heavy report stream.
          </p>
          <div className="site-consumption-pills">
            <span className="dashboard-meta-pill dashboard-meta-pill-stable">All-time window: 01 Jan 2025 to present</span>
            <span className="dashboard-meta-pill dashboard-meta-pill-monitor">{freshnessLabel}</span>
            {loading ? <span className="dashboard-meta-pill dashboard-meta-pill-critical">Loading snapshot</span> : null}
          </div>
        </div>

        <div className="site-consumption-actions">
          <button
            className="button button-primary"
            onClick={() => {
              void handleRefreshNow();
            }}
            type="button"
          >
            Refresh Now
          </button>
          <button
            className="button button-ghost"
            onClick={() => navigate("/data-report/consumption-statistics")}
            type="button"
          >
            Open Consumption Statistics
          </button>
        </div>
      </section>

      {error ? <p className="status-banner status-banner-error">{error}</p> : null}

      <section className="site-consumption-section">
        <div className="chart-header">
          <h2 className="chart-title">Site Totals</h2>
          <span className="site-consumption-note">Total consumption across all users for each site.</span>
        </div>

        <div className="site-consumption-site-grid">
          {snapshot.summary.map((item, index) => (
            <div key={item.site} className="premium-card">
              <div className="stat-content">
                <div className="stat-info">
                  <span className="stat-label-tiny">{item.site}</span>
                  <strong className="stat-value-huge">{item.totalConsumption.toFixed(2)}</strong>
                  <span className="stat-subtext">All users in the site</span>
                </div>
                <div className={`stat-icon-square ${statAccents[index % statAccents.length]}`} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="site-consumption-section-stack">
        <SiteConsumptionChart
          title="Daily Site Consumption"
          labels={snapshot.daily.labels}
          series={snapshot.daily.series}
          emptyMessage="Daily site consumption will appear here once the snapshot service returns labeled daily data."
        />
        <SiteConsumptionChart
          title="Monthly Site Consumption"
          labels={snapshot.monthly.labels}
          series={snapshot.monthly.series}
          emptyMessage="Monthly site consumption will appear here once the snapshot service returns labeled monthly data."
          variant="line"
        />
        <SiteConsumptionChart
          title="Yearly Site Consumption"
          labels={snapshot.yearly.labels}
          series={snapshot.yearly.series}
          emptyMessage="Yearly site consumption will appear here once the snapshot service returns labeled yearly data."
          variant="bar"
        />
      </section>
    </div>
  );
}
