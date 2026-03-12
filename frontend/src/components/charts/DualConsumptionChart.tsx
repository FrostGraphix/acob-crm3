import type { EChartsOption } from "echarts";
import { ReactEChartsCore, echarts } from "../../services/echarts";

interface DualConsumptionChartProps {
  labels: string[];
  dayValues: number[];
  nightValues: number[];
  title?: string;
}

export function DualConsumptionChart({
  labels,
  dayValues,
  nightValues,
  title = "Day vs Night Energy Consumption Trends",
}: DualConsumptionChartProps) {
  const option: EChartsOption = {
    title: {
      show: false,
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "var(--bg-panel)",
      borderColor: "var(--border-light)",
      borderWidth: 1,
      padding: [12, 16],
      textStyle: {
        color: "var(--text-main)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 12,
      },
      axisPointer: {
        type: "cross",
        label: {
          backgroundColor: "#6a7985",
        },
      },
    },
    legend: {
      data: ["Day Usage", "Night Usage"],
      textStyle: {
        color: "var(--text-muted)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      },
      right: 0,
      top: 0,
      icon: "circle",
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      top: "15%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: labels,
      axisLine: {
        lineStyle: { color: "var(--border-light)" },
      },
      axisLabel: {
        color: "var(--text-muted)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 11,
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: "var(--text-muted)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 11,
        formatter: (val: number) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val),
      },
      splitLine: {
        lineStyle: { color: "var(--border-subtle)", type: "dashed" },
      },
    },
    series: [
      {
        name: "Day Usage",
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 3, color: "var(--amber)" },
        itemStyle: { color: "var(--amber)" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(245, 158, 11, 0.2)" },
            { offset: 1, color: "rgba(245, 158, 11, 0)" },
          ]),
        },
        data: dayValues,
      },
      {
        name: "Night Usage",
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 3, color: "var(--sapphire)" },
        itemStyle: { color: "var(--sapphire)" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(59, 130, 246, 0.2)" },
            { offset: 1, color: "rgba(59, 130, 246, 0)" },
          ]),
        },
        data: nightValues,
      },
    ],
  };

  return (
    <div className="premium-chart-card">
      <div className="chart-header">
        <h3 className="chart-title">{title}</h3>
      </div>
      <div style={{ height: "300px", width: "100%" }}>
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
