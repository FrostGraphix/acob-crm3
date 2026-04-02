import type { EChartsOption } from "echarts";
import { ReactEChartsCore, echarts } from "../../services/echarts";

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
    title: title ? {
      text: title,
      textStyle: {
        color: "var(--text-main)",
        fontSize: 16,
        fontWeight: 600,
        fontFamily: "Inter, sans-serif"
      },
      left: "center",
      top: 0
    } : undefined,
    grid: {
      top: title ? 40 : 24,
      right: 20,
      bottom: 40,
      left: 60,
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "var(--bg-panel)",
      borderColor: "var(--border-light)",
      textStyle: {
        color: "var(--text-main)",
        fontFamily: "Inter, sans-serif",
      },
      valueFormatter: (value) =>
        typeof value === "number" ? value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(value ?? ""),
    },
    xAxis: {
      type: "category",
      data: labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "var(--border-light)" } },
      axisLabel: { 
        color: "var(--text-muted)", 
        fontFamily: "Inter, sans-serif",
        rotate: labels.length > 8 ? 32 : 0,
      },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "var(--border-light)", type: "dashed" } },
      axisLabel: {
        color: "var(--text-muted)",
        fontFamily: "Inter, sans-serif",
        formatter: (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 1 }),
      },
    },
    series: [
      {
        name: seriesName,
        type: type,
        data: values,
        smooth: type === "line",
        symbol: type === "line" ? "circle" : undefined,
        showSymbol: type === "line",
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
                color: "var(--text-muted)",
                fontFamily: "Inter, sans-serif",
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
    <div className="chart-card" style={{ height: "100%", minHeight: "350px", padding: "1rem" }}>
      <ReactEChartsCore
        className="echart-canvas"
        echarts={echarts}
        lazyUpdate
        notMerge
        option={option}
        style={{ height: "100%" }}
      />
    </div>
  );
}
