import type { EChartsOption } from "echarts";
import { ReactEChartsCore, echarts } from "../../services/echarts";

interface LineChartProps {
  labels: string[];
  values: number[];
}

export function LineChart({ labels, values }: LineChartProps) {
  const option: EChartsOption = {
    animationDuration: 700,
    grid: {
      top: 18,
      right: 12,
      bottom: 24,
      left: 38,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "line",
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
      boundaryGap: false,
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
        type: "line",
        data: values,
        smooth: true,
        showSymbol: false,
        symbolSize: 8,
        lineStyle: {
          width: 4,
          color: "#16a34a",
          shadowBlur: 18,
          shadowColor: "rgba(22, 163, 74, 0.24)",
        },
        itemStyle: {
          color: "#facc15",
          borderColor: "#16a34a",
          borderWidth: 2,
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(250, 204, 21, 0.24)" },
              { offset: 0.35, color: "rgba(22, 163, 74, 0.18)" },
              { offset: 1, color: "transparent" },
            ],
          },
        },
        emphasis: {
          focus: "series",
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
