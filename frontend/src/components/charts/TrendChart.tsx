import type { EChartsOption } from "echarts";
import { ReactEChartsCore, echarts } from "../../services/echarts";

interface TrendChartProps {
  type: "line" | "bar";
  labels: string[];
  values: number[];
  title?: string;
}

export function TrendChart({ type, labels, values, title }: TrendChartProps) {
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
    },
    xAxis: {
      type: "category",
      data: labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "var(--border-light)" } },
      axisLabel: { 
        color: "var(--text-muted)", 
        fontFamily: "Inter, sans-serif",
        rotate: labels.length > 10 ? 35 : 0
      },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "var(--border-light)", type: "dashed" } },
      axisLabel: { color: "var(--text-muted)", fontFamily: "Inter, sans-serif" },
    },
    series: [
      {
        type: type,
        data: values,
        smooth: type === "line",
        symbol: type === "line" ? "circle" : undefined,
        showSymbol: false,
        barMaxWidth: 30,
        lineStyle: {
          width: 3,
          color: "var(--acob-green)",
        },
        itemStyle: {
          color: "var(--acob-green)",
          borderRadius: type === "bar" ? [4, 4, 0, 0] : undefined
        },
        areaStyle: type === "line" ? {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(22, 163, 74, 0.2)" },
              { offset: 1, color: "transparent" },
            ],
          },
        } : undefined,
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
