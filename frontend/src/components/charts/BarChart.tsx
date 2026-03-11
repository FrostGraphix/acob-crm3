import type { EChartsOption } from "echarts";
import { ReactEChartsCore, echarts } from "../../services/echarts";

interface BarChartProps {
  labels: string[];
  values: number[];
}

export function BarChart({ labels, values }: BarChartProps) {
  const option: EChartsOption = {
    animationDuration: 700,
    grid: {
      top: 18,
      right: 10,
      bottom: 24,
      left: 36,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
      },
      backgroundColor: "var(--bg-panel)",
      borderColor: "var(--border-light)",
      padding: [12, 14],
      textStyle: {
        color: "var(--text-main)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      },
    },
    xAxis: {
      type: "category",
      data: labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "var(--border-light)" } },
      axisLabel: {
        color: "var(--text-muted)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 11,
        margin: 12,
      },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "var(--border-light)", type: "dashed" } },
      axisLabel: {
        color: "var(--text-muted)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 11,
      },
    },
    series: [
      {
        type: "bar",
        data: values,
        barMaxWidth: 26,
        showBackground: true,
        backgroundStyle: {
          color: "rgba(255, 255, 255, 0.04)",
          borderRadius: [18, 18, 8, 8],
        },
        itemStyle: {
          borderRadius: [18, 18, 8, 8],
          shadowBlur: 18,
          shadowColor: "rgba(6, 134, 18, 0.18)",
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "#facc15" },
              { offset: 0.35, color: "#22c55e" },
              { offset: 1, color: "rgba(6, 134, 18, 0.22)" },
            ],
          },
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 22,
            shadowColor: "rgba(250, 204, 21, 0.28)",
          },
        },
      },
    ],
  };

  return (
    <div className="chart-card">
      <ReactEChartsCore
        className="echart-canvas"
        echarts={echarts}
        lazyUpdate
        notMerge
        option={option}
      />
    </div>
  );
}
