import type { EChartsOption } from "echarts";
import { ReactEChartsCore, echarts } from "../../services/echarts";
import { ChartPanelHeader } from "./ChartPanelHeader";

interface BarChartProps {
  labels: string[];
  values: number[];
  barColorStops?: Array<{ offset: number; color: string }>;
  barMaxWidth?: number;
  heightClassName?: string;
  xAxisLabelInterval?: number | "auto";
  yAxisMax?: number;
  chartTitle?: string;
}

const defaultBarColorStops = [
  { offset: 0, color: "rgba(6, 134, 18, 0.92)" },
  { offset: 1, color: "rgba(6, 134, 18, 0.24)" },
];

export function BarChart({
  labels,
  values,
  barColorStops = defaultBarColorStops,
  barMaxWidth = 22,
  heightClassName,
  xAxisLabelInterval = "auto",
  yAxisMax,
  chartTitle,
}: BarChartProps) {
  const option: EChartsOption = {
    animationDuration: 500,
    grid: {
      top: 10,
      right: 10,
      bottom: 18,
      left: 42,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
      },
      backgroundColor: "#111b31",
      borderColor: "rgba(148, 163, 184, 0.18)",
      borderWidth: 1,
      extraCssText: "border-radius: 14px; box-shadow: 0 18px 44px rgba(2, 6, 23, 0.34);",
      padding: [12, 14],
      textStyle: {
        color: "#e5eefc",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      },
    },
    xAxis: {
      type: "category",
      data: labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "rgba(148, 163, 184, 0.18)" } },
      axisLabel: {
        color: "#94a3b8",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 11,
        margin: 12,
        interval: xAxisLabelInterval,
      },
    },
    yAxis: {
      type: "value",
      max: yAxisMax,
      splitLine: { lineStyle: { color: "rgba(71, 85, 105, 0.42)", type: "dashed" } },
      axisLabel: {
        color: "#94a3b8",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 11,
        formatter: (value: number) => (Math.abs(value) >= 1_000 ? `${(value / 1_000).toFixed(0)}k` : `${value}`),
      },
    },
    series: [
      {
        type: "bar",
        data: values,
        barMaxWidth,
        showBackground: true,
        backgroundStyle: {
          color: "color-mix(in srgb, var(--text-main) 5%, transparent)",
          borderRadius: [6, 6, 0, 0],
        },
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: barColorStops,
          },
        },
        emphasis: {
          itemStyle: {
            color: barColorStops[0]?.color ?? "rgba(6, 134, 18, 1)",
          },
        },
      },
    ],
  };

  return (
    <div className="chart-card chart-card--themed">
      {chartTitle ? <ChartPanelHeader title={chartTitle} /> : null}
      <ReactEChartsCore
        className={heightClassName ? `echart-canvas chart-card__canvas ${heightClassName}` : "echart-canvas chart-card__canvas"}
        echarts={echarts}
        lazyUpdate
        notMerge
        option={option}
      />
    </div>
  );
}
