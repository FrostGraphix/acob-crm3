import type { EChartsOption } from "echarts";
import { ReactEChartsCore, echarts } from "../../services/echarts";
import type { SiteConsumptionSeriesRow } from "../../services/site-consumption";

interface SiteConsumptionChartProps {
  title: string;
  labels: string[];
  series: SiteConsumptionSeriesRow[];
  variant?: "line" | "bar";
  emptyMessage?: string;
}

const siteColors = ["#16a34a", "#3b82f6", "#f59e0b", "#8b5cf6", "#14b8a6"];

function toTooltipValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  return String(value ?? "");
}

export function SiteConsumptionChart({
  title,
  labels,
  series,
  variant = "line",
  emptyMessage = "No site trend data is available yet.",
}: SiteConsumptionChartProps) {
  if (labels.length === 0) {
    return (
      <div className="premium-chart-card">
        <div className="chart-header">
          <h3 className="chart-title">{title}</h3>
        </div>
        <div
          style={{
            minHeight: "300px",
            display: "grid",
            placeItems: "center",
            color: "var(--text-muted)",
            textAlign: "center",
            padding: "1.5rem",
          }}
        >
          <p style={{ margin: 0, maxWidth: "28rem" }}>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  const option: EChartsOption = {
    animationDuration: 700,
    legend: {
      data: series.map((entry) => entry.site),
      top: 4,
      right: 0,
      icon: "circle",
      textStyle: {
        color: "var(--text-muted)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 11,
      },
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "var(--bg-panel)",
      borderColor: "var(--border-light)",
      padding: [12, 14],
      textStyle: {
        color: "var(--text-main)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      },
      valueFormatter: toTooltipValue,
    },
    grid: {
      top: 40,
      right: 20,
      bottom: 36,
      left: 56,
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: variant === "bar",
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "var(--border-light)" } },
      axisLabel: {
        color: "var(--text-muted)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 11,
        margin: 14,
        rotate: labels.length > 8 ? 28 : 0,
      },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "var(--border-light)", type: "dashed" } },
      axisLabel: {
        color: "var(--text-muted)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 11,
        formatter: (value: number) =>
          value >= 1000 ? value.toLocaleString("en-US", { maximumFractionDigits: 1 }) : String(value),
      },
    },
    series: series.map((entry, index) => ({
      name: entry.site,
      type: variant,
      data: entry.values,
      smooth: variant === "line",
      showSymbol: variant === "line",
      symbolSize: 7,
      barMaxWidth: 24,
      lineStyle: {
        width: 3,
        color: siteColors[index % siteColors.length],
      },
      itemStyle: {
        color: siteColors[index % siteColors.length],
      },
      areaStyle:
        variant === "line"
          ? {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                {
                  offset: 0,
                  color: `${siteColors[index % siteColors.length]}33`,
                },
                {
                  offset: 1,
                  color: "transparent",
                },
              ]),
            }
          : undefined,
      emphasis: {
        focus: "series",
      },
      stack: variant === "bar" ? "siteConsumption" : undefined,
    })),
  };

  return (
    <div className="premium-chart-card">
      <div className="chart-header">
        <h3 className="chart-title">{title}</h3>
      </div>
      <div style={{ minHeight: "300px", width: "100%" }}>
        <ReactEChartsCore
          echarts={echarts}
          lazyUpdate
          notMerge
          option={option}
          style={{ height: "100%", width: "100%" }}
        />
      </div>
    </div>
  );
}
