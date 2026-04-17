import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable } from "../common/DataTable";
import { Badge } from "../../design-system";
import { Modal } from "../ui/Modal";
import { AnalyticsMixPanel } from "../analytics/AnalyticsMixPanel";
import { MetricCard } from "../../design-system";
import {
  loadManagementConsumption,
  loadManagementMeterConsumption,
  type ManagementConsumptionResponse,
  type ManagementMeterConsumptionRow,
} from "../../services/management-analytics";
import { request } from "../../services/api";
import { SITE_CONSUMPTION_SITES } from "../../services/site-consumption-report";
import type { DataRow, TableColumn } from "../../types";

import type { DataPageSnapshot } from "../../pages/DataPage";

interface SiteConsumptionReportViewProps {
  onSnapshotChange: (snapshot: DataPageSnapshot) => void;
}


export function SiteConsumptionReportView({ onSnapshotChange }: SiteConsumptionReportViewProps) {
  // State
  const [selectedSite, setSelectedSite] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stats State
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [consumptionSummary, setConsumptionSummary] = useState<ManagementConsumptionResponse["summary"] | null>(null);

  // Table State
  const [rows, setRows] = useState<ManagementMeterConsumptionRow[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<ManagementMeterConsumptionRow | null>(null);

  // Search State
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  // Column Definitions
  const columns = useMemo<TableColumn[]>(() => [
    {
      key: "customerName",
      label: "Customer Name",
      align: "start",
      searchable: true,
    },
    {
      key: "meterId",
      label: "Meter ID",
      align: "start",
      searchable: true,
    },
    { key: "site", label: "Site", align: "start" },
    { key: "totalKwh", label: "Total kWh", align: "end" },
    { key: "dayKwh", label: "Day kWh", align: "end" },
    { key: "nightKwh", label: "Night kWh", align: "end" },
    { key: "percentDay", label: "Day %", align: "end" },
  ], []);

  // API Call: Total Customers (Real total from Customer API)
  const fetchCustomerCount = useCallback(async (site: string) => {
    try {
      // Station filter names as used in customer API
      const stationId = site === "ALL" ? undefined : site;
      const resp = await request<{ total: number }>("/api/customer/read", {
        method: "POST",
        body: {
          pageSize: 1, // We only need the total
          stationId,
        },
      });
      setCustomerCount(resp.total);
    } catch (e) {
      console.error("Failed to fetch customer count", e);
    }
  }, []);

  // API Call: Consumption Summary (Analytics summary)
  const fetchConsumptionSummary = useCallback(async (site: string) => {
    try {
      const resp = await loadManagementConsumption(site === "ALL" ? null : site);
      setConsumptionSummary(resp.summary);
      setLastSync(resp.lastUpdatedAt);
    } catch (e) {
      console.error("Failed to fetch consumption summary", e);
    }
  }, []);

  // API Call: Meter Consumption Table (Paginated + Search)
  const fetchTableData = useCallback(async (site: string, page: number, size: number, filters: Record<string, string>) => {
    setLoading(true);
    try {
      const resp = await loadManagementMeterConsumption(site === "ALL" ? null : site, {
        pageNumber: page,
        pageSize: size,
        search: {
          customerName: filters.customerName,
          meterId: filters.meterId,
        }
      });
      setRows(resp.rows);
      setTotal(resp.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load consumption records");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial Load & Refresh Logic
  useEffect(() => {
    setRefreshing(true);
    setError(null);
    const site = selectedSite;

    void Promise.all([
      fetchCustomerCount(site),
      fetchConsumptionSummary(site),
      fetchTableData(site, pageNumber, pageSize, columnFilters),
    ]);
  }, [selectedSite, pageNumber, pageSize, fetchCustomerCount, fetchConsumptionSummary, fetchTableData, columnFilters]);

  // Handle Export/Snapshot (External integration)
  useEffect(() => {
    onSnapshotChange({
      rows: rows as unknown as DataRow[],
      total,
      loading,
      error,
      appliedFilters: { site: selectedSite },
    });
  }, [rows, total, loading, error, selectedSite, onSnapshotChange]);

  const handleRefresh = () => {
    setRefreshing(true);
    void Promise.all([
      fetchCustomerCount(selectedSite),
      fetchConsumptionSummary(selectedSite),
      fetchTableData(selectedSite, pageNumber, pageSize, columnFilters),
    ]);
  };

  const getRowKey = (row: DataRow) => `${row.meterId}-${row.site}`;

  return (
    <section className="site-consumption-report token-record-page" aria-live="polite">
      {/* 2-Line Hero Section */}
      <div className="token-record-hero">
        <div className="token-record-hero__copy">
          <div className="token-record-hero__title-row">
            <h2 className="token-record-hero__title">Site Consumption Report</h2>
            <Badge tone={refreshing ? "neutral" : "success"} className="token-record-live-pill">
              {refreshing ? "Refreshing..." : "Active view"}
            </Badge>
          </div>
          <div className="token-record-hero__meta">
            <span>Records: {total.toLocaleString()} rows</span>
            <span>Range: 01-01-2025 to Present</span>
            <span>Last Sync: {lastSync ? new Date(lastSync).toLocaleTimeString() : "Pending"}</span>
          </div>
        </div>

        <div className="token-record-hero__actions">
          <div className="hero-action-group">
            <select
              className="hero-action-select"
              value={selectedSite}
              onChange={(e) => {
                setSelectedSite(e.target.value);
                setPageNumber(1);
              }}
            >
              <option value="ALL">All Sites</option>
              {SITE_CONSUMPTION_SITES.map(site => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>
            <button
              className="button button-primary token-record-hero__button"
              onClick={handleRefresh}
              disabled={loading || refreshing}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Compact Stat Cards */}
      <section className="token-record-stats">
        <div className="token-record-stats__grid">
          <article className="token-record-stats-card token-record-stats-card--cyan">
            <div className="token-record-stats-card__icon">
              <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <div className="token-record-stats-card__body">
              <span className="token-record-stats-card__label">Total Customers</span>
              <strong className="token-record-stats-card__value">{customerCount.toLocaleString()}</strong>
              <span className="token-record-stats-card__note">Across {selectedSite === "ALL" ? "all sites" : selectedSite}</span>
            </div>
          </article>

          <article className="token-record-stats-card token-record-stats-card--emerald">
            <div className="token-record-stats-card__icon">
              <svg fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M13 2 5 14h6l-1 8 8-12h-6l1-8Z" /></svg>
            </div>
            <div className="token-record-stats-card__body">
              <span className="token-record-stats-card__label">Total Energy Consumption</span>
              <strong className="token-record-stats-card__value">
                {consumptionSummary?.totalConsumptionKwh.toLocaleString("en-US", { maximumFractionDigits: 1 }) ?? "0"} kWh
              </strong>
              <span className="token-record-stats-card__note">Total for 2025 selected period</span>
            </div>
          </article>
        </div>
      </section>

      {/* Paginated Table */}
      <div className="site-report-table-section">
        <DataTable
          columns={columns}
          rows={rows as unknown as DataRow[]}
          selectedKeys={[]}
          pageNumber={pageNumber}
          pageSize={pageSize}
          total={total}
          loading={loading}
          selectionMode="none"
          getRowKey={getRowKey}
          onPageChange={setPageNumber}
          onPageSizeChange={setPageSize}
          columnFilters={columnFilters}
          onColumnFilterChange={(key, val) => setColumnFilters(prev => ({ ...prev, [key]: val }))}
          onColumnSearch={() => setPageNumber(1)}
          onToggleAll={() => { }}
          onToggleRow={() => { }}
          onRowAction={() => { }}
          onRowClick={(row) => setSelectedCustomer(row as unknown as ManagementMeterConsumptionRow)}
        />
      </div>

      {/* Customer Detail Modal */}
      <Modal
        open={selectedCustomer != null}
        onClose={() => setSelectedCustomer(null)}
        size="xl"
        title={selectedCustomer?.customerName || "Customer Analytics"}
        subtitle={`${selectedCustomer?.site} • Meter ${selectedCustomer?.meterId}`}
      >
        {selectedCustomer && (
          <div className="site-customer-modal">
            <div className="site-customer-modal__summary">
              <MetricCard
                label="Total Consumption"
                value={`${selectedCustomer.totalKwh.toLocaleString()} kWh`}
                tone="success"
                icon={<EnergyIcon />}
              />
              <MetricCard
                label="Day Participation"
                value={`${selectedCustomer.percentDay}%`}
                tone="info"
                icon={<DayIcon />}
              />
              <MetricCard
                label="Last Snapshot"
                value={selectedCustomer.snapshotDate ?? "--"}
                tone="neutral"
                icon={<SnapshotIcon />}
              />
            </div>
            <AnalyticsMixPanel endpoint="/api/customer/360-lite" query={{ meterId: selectedCustomer.meterId }} />
          </div>
        )}
      </Modal>
    </section>
  );
}

function EnergyIcon() {
  return <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function DayIcon() {
  return <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364-1.414-1.414M7.05 7.05 5.636 5.636m12.728 0L16.95 7.05M7.05 16.95l-1.414 1.414M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function SnapshotIcon() {
  return <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
