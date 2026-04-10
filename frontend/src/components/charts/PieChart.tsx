import type { EChartsOption } from "echarts";
import { ReactEChartsCore, echarts } from "../../services/echarts";
import type { PieSlice } from "../../types";
import { ChartPanelHeader } from "./ChartPanelHeader";

interface PieChartProps {
  slices: PieSlice[];
  colors?: string[];
  donut?: boolean;
  showLegend?: boolean;
  showCenterLabel?: boolean;
  heightClassName?: string;
  labelMode?: "legend" | "outside";
  chartTitle?: string;
}

const defaultColors = [
  "#068612",
  "rgba(6, 134, 18, 0.78)",
  "rgba(20, 33, 20, 0.74)",
  "rgba(20, 33, 20, 0.58)",
  "#9ca3af",
  "#d1d5db",
  "#4b5563",
];

export function PieChart({
  slices,
  colors = defaultColors,
  donut = true,
  showLegend = true,
  showCenterLabel = true,
  heightClassName,
  labelMode = "legend",
  chartTitle,
}: PieChartProps) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  const option: EChartsOption = {
    title: [
      ...(showCenterLabel
        ? [{
            text: total.toLocaleString(),
            subtext: "Total alarms",
            left: "center",
            top: showLegend ? "36%" : "42%",
            textStyle: {
              color: "var(--text-main)",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 20,
              fontWeight: 800,
            },
            subtextStyle: {
              color: "var(--text-muted)",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 11,
            },
          }]
        : []),
    ],
    tooltip: {
      trigger: "item",
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
    legend: showLegend
      ? {
          bottom: 0,
          left: "center",
          icon: "circle",
          itemGap: 18,
          textStyle: {
            color: "var(--text-muted)",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 11,
          },
        }
      : undefined,
    series: [
      {
        name: "Abnormal Alarm",
        type: "pie",
        radius: donut ? ["58%", "78%"] : ["0%", "74%"],
        center: ["50%", labelMode === "outside" ? "55%" : "40%"],
        itemStyle: {
          borderRadius: 4,
          borderColor: "var(--bg-panel)",
          borderWidth: 2,
        },
        label: {
          show: labelMode === "outside",
          formatter: "{b}",
          color: "var(--text-main)",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 11,
          fontWeight: 600,
        },
        labelLine: {
          show: labelMode === "outside",
        },
        emphasis: {
          scale: true,
          scaleSize: 10,
        },
        data: slices.map((slice, index) => ({
          name: slice.label,
          value: slice.value,
          label: labelMode === "outside"
            ? {
                color: colors[index % colors.length],
              }
            : undefined,
          labelLine: labelMode === "outside"
            ? {
                lineStyle: {
                  color: colors[index % colors.length],
                },
              }
            : undefined,
        })),
      },
    ],
    color: colors,
  };

  return (
    <div className="chart-card chart-card--themed">
      {chartTitle ? <ChartPanelHeader title={chartTitle} /> : null}
      <ReactEChartsCore
        className={
          heightClassName
            ? `echart-canvas pie-echart-canvas chart-card__canvas ${heightClassName}`
            : "echart-canvas pie-echart-canvas chart-card__canvas"
        }
        echarts={echarts}
        lazyUpdate
        notMerge
        option={option}
      />
    </div>
  );
}
