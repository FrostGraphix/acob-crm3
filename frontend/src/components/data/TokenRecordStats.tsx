import { useEffect, useMemo, useState, type ReactNode } from "react";
import { loadTableData } from "../../services/api";
import { formatNaira, formatNumber } from "../../services/currency.ts";
import { buildReadPayload } from "../../services/payload-mapper";
import type { DataPageConfig, DataRow } from "../../types";

interface TokenRecordStatsProps {
  page: DataPageConfig;
  appliedFilters: Record<string, string>;
  rows: DataRow[];
  total: number;
}

interface TokenRecordStatItem {
  label: string;
  value: string;
  note: string;
  accentClassName: string;
  icon: ReactNode;
}

function readNumber(value: DataRow[string]) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (normalized.length === 0) {
      return 0;
    }

    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function formatCompactNumber(value: number, fractionDigits = 2) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return formatNumber(value, { maximumFractionDigits: fractionDigits });
}

function extractValue(row: DataRow, keys: string[]): number {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null && val !== "") {
      const num = readNumber(val);
      if (num > 0) return num;
    }
  }
  return 0;
}

export function TokenRecordStats({ page, appliedFilters, rows, total }: TokenRecordStatsProps) {
  const loadedRevenue = useMemo(
    () => rows.reduce((sum, row) => sum + extractValue(row, ["totalPrice", "totalPaid", "price", "amountNaira"]), 0),
    [rows],
  );
  const [aggregateRevenue, setAggregateRevenue] = useState(loadedRevenue);
  const [aggregateRevenueError, setAggregateRevenueError] = useState(false);
  const needsAggregateFetch = total > rows.length;
  const revenueNote = total <= 0
    ? "Records in result set"
    : total <= rows.length
      ? `Across ${formatCompactNumber(total, 0)} records`
      : aggregateRevenueError
        ? "Loaded rows"
        : "Calculating full result set";
  const displayedRevenue = total <= 0 ? 0 : needsAggregateFetch ? aggregateRevenue : loadedRevenue;

  useEffect(() => {
    let cancelled = false;

    if (!needsAggregateFetch) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const chunkSize = 500;
      const pageCount = Math.ceil(total / chunkSize);
      let revenueSum = 0;

      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const payload = buildReadPayload(page, appliedFilters, pageNumber, chunkSize);
        if (!payload.ok || !payload.payload) {
          throw new Error(payload.message ?? "Invalid aggregate payload");
        }

        const response = await loadTableData(page.readEndpoint, payload.payload);
        revenueSum += response.rows.reduce((sum, row) => sum + extractValue(row, ["totalPrice", "totalPaid", "price", "amountNaira"]), 0);
      }

      if (!cancelled) {
        setAggregateRevenue(revenueSum);
        setAggregateRevenueError(false);
      }
    })().catch(() => {
      if (!cancelled) {
        setAggregateRevenueError(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [appliedFilters, needsAggregateFetch, page, total]);

  const stats = useMemo<TokenRecordStatItem[]>(() => {
    const visibleUnits = rows.reduce((sum, row) => sum + extractValue(row, ["totalUnit", "unit", "amount"]), 0);
    return [
      {
        label: "Total Records",
        value: formatCompactNumber(total, 0),
        note: "Records in result set",
        accentClassName: "token-record-stats-card--emerald",
        icon: (
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
            <path d="M8 7h8M8 12h8M8 17h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
            <rect height="16" rx="3" stroke="currentColor" strokeWidth="1.8" width="14" x="5" y="4" />
          </svg>
        ),
      },
      {
        label: "Total Revenue",
        value: formatNaira(displayedRevenue),
        note: revenueNote,
        accentClassName: "token-record-stats-card--cyan",
        icon: (
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
            <path d="M12 4v16M16.5 7.5a3.5 3.5 0 0 0-3.5-2.5h-2a3 3 0 0 0 0 6h2a3 3 0 0 1 0 6h-2a3.5 3.5 0 0 1-3.5-2.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          </svg>
        ),
      },
      {
        label: "Energy Dispensed",
        value: `${formatCompactNumber(visibleUnits, 2)} kWh`,
        note: "Total units on page",
        accentClassName: "token-record-stats-card--violet",
        icon: (
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
            <path d="M13 2 5 14h6l-1 8 8-12h-6l1-8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
          </svg>
        ),
      },
    ];
  }, [displayedRevenue, revenueNote, rows, total]);

  return (
    <section className="token-record-stats">
      <div className="token-record-stats__grid">
        {stats.map((stat) => (
          <article className={`token-record-stats-card ${stat.accentClassName}`} key={stat.label}>
            <div className="token-record-stats-card__icon">{stat.icon}</div>
            <div className="token-record-stats-card__body">
              <span className="token-record-stats-card__label">{stat.label}</span>
              <strong className="token-record-stats-card__value">{stat.value}</strong>
              <span className="token-record-stats-card__note">{stat.note}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
