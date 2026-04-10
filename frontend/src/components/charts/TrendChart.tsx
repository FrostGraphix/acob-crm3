import type { EChartsOption } from "echarts";
import { ReactEChartsCore, echarts } from "../../services/echarts";
import { ChartPanelHeader } from "./ChartPanelHeader";

interface TrendChartProps {
  type: "line" | "bar";
  labels: string[];
  values: number[];
  title?: string;
  averageValue?: number;
  seriesName?: string;
}

export function TrendChart({
  type,
  labels,
  values,
  title,
  averageValue,
  seriesName = "Series",
}: TrendChartProps) {
  const isBar = type === "bar";

  const option: EChartsOption = {
    grid: {
      top: 10,
      right: 16,
      bottom: 26,
      left: 52,
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#111b31",
      borderColor: "rgba(148, 163, 184, 0.18)",
      borderWidth: 1,
      extraCssText: "border-radius: 14px; box-shadow: 0 18px 44px rgba(2, 6, 23, 0.34);",
      textStyle: {
        color: "#e5eefc",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      },
      valueFormatter: (value) =>
        typeof value === "number" ? value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(value ?? ""),
    },
    xAxis: {
      type: "category",
      data: labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "rgba(148, 163, 184, 0.18)" } },
      axisLabel: { 
        color: "#94a3b8", 
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        rotate: labels.length > 8 ? 32 : 0,
      },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "rgba(71, 85, 105, 0.42)", type: "dashed" } },
      axisLabel: {
        color: "#94a3b8",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        formatter: (value: number) =>
          Math.abs(value) >= 1_000
            ? `${(value / 1_000).toFixed(0)}k`
            : value.toLocaleString("en-US", { maximumFractionDigits: 1 }),
      },
    },
    series: [
      {
        name: seriesName,
        type: type,
        data: values,
        smooth: type === "line",
        symbol: type === "line" ? "circle" : undefined,
        showSymbol: false,
        symbolSize: 7,
        barMaxWidth: 30,
        lineStyle: {
          width: 3,
          color: isBar ? "#16a34a" : "#22c55e",
        },
        itemStyle: {
          color: isBar
            ? {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: "#86efac" },
                  { offset: 0.45, color: "#22c55e" },
                  { offset: 1, color: "#15803d" },
                ],
              }
            : "#22c55e",
          borderRadius: type === "bar" ? [10, 10, 3, 3] : undefined,
        },
        areaStyle: type === "line" ? {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(34, 197, 94, 0.28)" },
              { offset: 1, color: "transparent" },
            ],
          },
        } : undefined,
        markLine: averageValue && Number.isFinite(averageValue)
          ? {
              symbol: "none",
              label: {
                formatter: `Average ${averageValue.toFixed(2)}`,
                color: "#94a3b8",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              },
              lineStyle: {
                type: "dashed",
                color: "#facc15",
                width: 2,
              },
              data: [{ yAxis: averageValue }],
            }
          : undefined,
      },
    ],
  };

  return (
    <div className="chart-card chart-card--themed" style={{ height: "100%", minHeight: "350px" }}>
      {title ? <ChartPanelHeader title={title} /> : null}
      <ReactEChartsCore
        className="echart-canvas chart-card__canvas"
        echarts={echarts}
        lazyUpdate
        notMerge
        option={option}
        style={{ height: "100%" }}
      />
    </div>
  );
}
