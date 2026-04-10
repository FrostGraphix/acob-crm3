import type { EChartsOption } from "echarts";
import { ReactEChartsCore, echarts } from "../../services/echarts";
import { ChartPanelHeader } from "./ChartPanelHeader";

interface DualConsumptionChartProps {
  labels: string[];
  dayValues: number[];
  nightValues: number[];
  title?: string;
  dayLabel?: string;
  nightLabel?: string;
  height?: number;
  className?: string;
}

function formatTooltipValue(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} kWh`;
}

export function DualConsumptionChart({
  labels,
  dayValues,
  nightValues,
  title = "Day vs Night Energy Consumption Trends",
  dayLabel = "Day kWh",
  nightLabel = "Night kWh",
  height = 320,
  className,
}: DualConsumptionChartProps) {
  const nightColor = "#34d399";

  const option: EChartsOption = {
    title: {
      show: false,
    },
    tooltip: {
      trigger: "axis",
      formatter: (params) => {
        const points = Array.isArray(params) ? params : [params];
        const dayPoint = points.find((entry) => entry.seriesName === dayLabel);
        const nightPoint = points.find((entry) => entry.seriesName === nightLabel);
        const dayValue = typeof dayPoint?.value === "number" ? dayPoint.value : Number(dayPoint?.value ?? 0);
        const nightValue = typeof nightPoint?.value === "number" ? nightPoint.value : Number(nightPoint?.value ?? 0);
        const totalValue = dayValue + nightValue;
        const firstPointRecord =
          typeof points[0] === "object" && points[0] !== null
            ? (points[0] as unknown as Record<string, unknown>)
            : null;
        const label = String(firstPointRecord?.axisValueLabel ?? points[0]?.name ?? "");

        return `
          <div style="min-width:220px;">
            <div style="font-weight:700; color:#f8fafc; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid rgba(148,163,184,0.18);">${label}</div>
            <div style="display:flex; justify-content:space-between; gap:16px; margin-bottom:6px;">
              <span style="display:inline-flex; align-items:center; gap:6px; color:#fbbf24;">
                <span style="width:8px; height:8px; border-radius:999px; background:#fbbf24;"></span>
                Day (06-18h):
              </span>
              <span style="font-family:JetBrains Mono, monospace; color:#f8fafc;">${formatTooltipValue(dayValue)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; gap:16px;">
              <span style="display:inline-flex; align-items:center; gap:6px; color:${nightColor};">
                <span style="width:8px; height:8px; border-radius:999px; background:${nightColor};"></span>
                Night (18-06h):
              </span>
              <span style="font-family:JetBrains Mono, monospace; color:#f8fafc;">${formatTooltipValue(nightValue)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; gap:16px; margin-top:8px; padding-top:8px; border-top:1px solid rgba(148,163,184,0.18);">
              <span style="font-weight:700; color:#94a3b8;">Total:</span>
              <span style="font-family:JetBrains Mono, monospace; font-weight:700; color:#22c55e;">${formatTooltipValue(totalValue)}</span>
            </div>
          </div>
        `;
      },
      backgroundColor: "rgba(15, 23, 42, 0.96)",
      borderColor: "rgba(51, 65, 85, 0.9)",
      borderWidth: 1,
      padding: [12, 14],
      textStyle: {
        color: "#f8fafc",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 12,
      },
      axisPointer: {
        type: "line",
        label: {
          backgroundColor: "#0f172a",
        },
        lineStyle: {
          color: "rgba(148, 163, 184, 0.25)",
        },
      },
    },
    legend: {
      data: [dayLabel, nightLabel],
      textStyle: {
        color: "#94a3b8",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 11,
      },
      left: "center",
      bottom: 0,
      icon: "circle",
      itemWidth: 10,
      itemHeight: 10,
    },
    grid: {
      left: "2%",
      right: "2%",
      bottom: "12%",
      top: "10%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: labels,
      axisLine: {
        show: false,
      },
      axisLabel: {
        color: "#94a3b8",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 11,
      },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: "#94a3b8",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 11,
        formatter: (val: number) => `${(val / 1000).toFixed(0)}k`,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        lineStyle: { color: "rgba(51, 65, 85, 0.8)", type: "dashed" },
      },
    },
    series: [
      {
        name: dayLabel,
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2.5, color: "#fbbf24" },
        itemStyle: { color: "#fbbf24" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(251, 191, 36, 0.22)" },
            { offset: 1, color: "rgba(251, 191, 36, 0)" },
          ]),
        },
        data: dayValues,
      },
      {
        name: nightLabel,
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2.5, color: nightColor },
        itemStyle: { color: nightColor },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(52, 211, 153, 0.2)" },
            { offset: 1, color: "rgba(52, 211, 153, 0)" },
          ]),
        },
        data: nightValues,
      },
    ],
  };

  return (
    <div className={className ? `premium-chart-card ${className}` : "premium-chart-card"}>
      <ChartPanelHeader title={title} />
      <div style={{ height: `${height}px`, width: "100%" }}>
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
