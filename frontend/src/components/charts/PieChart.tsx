import type { EChartsOption } from "echarts";
import { ReactEChartsCore, echarts } from "../../services/echarts";
import type { PieSlice } from "../../types";

interface PieChartProps {
  slices: PieSlice[];
}

export function PieChart({ slices }: PieChartProps) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  const option: EChartsOption = {
    title: {
      text: total.toLocaleString(),
      subtext: "Total alarms",
      left: "center",
      top: "34%",
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
    },
    tooltip: {
      trigger: "item",
      backgroundColor: "var(--bg-panel)",
      borderColor: "var(--border-light)",
      padding: [12, 14],
      textStyle: {
        color: "var(--text-main)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      },
    },
    legend: {
      bottom: 0,
      left: "center",
      icon: "circle",
      itemGap: 18,
      textStyle: {
        color: "var(--text-muted)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 11,
      },
    },
    series: [
      {
        name: "Abnormal Alarm",
        type: "pie",
        radius: ["58%", "78%"],
        center: ["50%", "40%"],
        itemStyle: {
          borderRadius: 12,
          borderColor: "var(--bg-panel)",
          borderWidth: 3,
        },
        label: {
          show: false,
        },
        labelLine: {
          show: false,
        },
        emphasis: {
          scale: true,
          scaleSize: 10,
        },
        data: slices.map((slice) => ({
          name: slice.label,
          value: slice.value,
        })),
      },
    ],
    color: [
      "#16a34a", // ACOB Green
      "#3b82f6", // Blue
      "#f59e0b", // Amber
      "#ef4444", // Red
      "#14b8a6", // Teal
      "#0ea5e9", // Sky
      "#84cc16", // Lime
    ],
  };

  return (
    <div className="chart-card">
      <ReactEChartsCore
        className="echart-canvas pie-echart-canvas"
        echarts={echarts}
        lazyUpdate
        notMerge
        option={option}
      />
    </div>
  );
}
