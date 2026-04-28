import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CreditCard, RefreshCw, ShoppingCart, Users } from "lucide-react";
import type { EChartsCoreOption } from "echarts/core";
import { apiClient } from "../services/api";
import { ReactEChartsCore, echarts } from "../services/echarts";

interface DashboardSeries {
  xData: string[];
  yData: number[];
}

interface PanelGroupData {
  totalAccountCount: number;
  totalPurchaseTimes: number;
  totalPurchaseUnit: number;
  totalPurchaseMoney: number;
}

const emptySeries: DashboardSeries = { xData: [], yData: [] };

const cardDefinitions = [
  {
    type: 0,
    key: "totalAccountCount",
    label: "Account Count",
    icon: Users,
    color: "#40c9c6",
    duration: "2600ms",
  },
  {
    type: 1,
    key: "totalPurchaseTimes",
    label: "Purchase Times",
    icon: BarChart3,
    color: "#36a3f7",
    duration: "3000ms",
  },
  {
    type: 2,
    key: "totalPurchaseUnit",
    label: "Purchase Unit",
    icon: ShoppingCart,
    color: "#34bfa3",
    duration: "3600ms",
  },
  {
    type: 3,
    key: "totalPurchaseMoney",
    label: "Purchase Money",
    icon: CreditCard,
    color: "#f4516c",
    duration: "3200ms",
  },
] as const;

const chartTitles: Record<number, string> = {
  0: "Account Count",
  1: "Purchase Times",
  2: "Purchase Unit",
  3: "Purchase Money",
  4: "Daily Consumption",
  5: "Monthly Consumption",
  6: "Communication Success Rate",
  7: "Abnormal Alarm",
};

function toSeries(value: unknown): DashboardSeries {
  if (typeof value !== "object" || value === null) {
    return emptySeries;
  }

  const record = value as Record<string, unknown>;
  const xData = Array.isArray(record.xData)
    ? record.xData.map((entry) => String(entry))
    : [];
  const yData = Array.isArray(record.yData)
    ? record.yData.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry))
    : [];

  return {
    xData: xData.slice(0, yData.length),
    yData,
  };
}

function createBarOption(series: DashboardSeries, title: string): EChartsCoreOption {
  return {
    title: { left: "center", text: title },
    xAxis: { data: series.xData, axisTick: { show: false } },
    grid: { left: 10, right: 10, bottom: 20, top: 30, containLabel: true },
    tooltip: { trigger: "axis", axisPointer: { type: "cross" }, padding: [5, 10] },
    yAxis: { axisTick: { show: false }, minInterval: 1 },
    series: [
      {
        name: "value",
        smooth: true,
        type: "bar",
        itemStyle: {
          color: "#3888fa",
          lineStyle: { color: "#3888fa", width: 2 },
          areaStyle: { color: "#f3f8ff" },
        },
        data: series.yData,
        animationDuration: 2000,
        animationEasing: "quadraticOut",
      },
    ],
  };
}

function createLineOption(series: DashboardSeries, title: string): EChartsCoreOption {
  return {
    title: { left: "center", text: title },
    xAxis: { data: series.xData, axisTick: { show: false } },
    grid: { left: 10, right: 10, bottom: 20, top: 30, containLabel: true },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      padding: [5, 10],
      formatter: "{b} <br/>{a} : {c}%",
    },
    yAxis: { axisTick: { show: false }, minInterval: 1 },
    series: [
      {
        name: "value",
        smooth: true,
        type: "line",
        itemStyle: {
          color: "#3888fa",
          lineStyle: { color: "#3888fa", width: 2 },
          areaStyle: { color: "#f3f8ff" },
        },
        data: series.yData,
        animationDuration: 2000,
        animationEasing: "quadraticOut",
      },
    ],
  };
}

function createPieOption(series: DashboardSeries, title: string): EChartsCoreOption {
  return {
    title: { text: title, align: "center" },
    tooltip: { trigger: "item", formatter: "{a} <br/>{b} : {c} ({d}%)" },
    legend: { left: "center", bottom: "10", data: series.xData },
    series: [
      {
        name: title,
        type: "pie",
        roseType: "radius",
        radius: [15, 95],
        center: ["50%", "38%"],
        data: series.xData.map((name, index) => ({
          name,
          value: series.yData[index] ?? 0,
        })),
        animationEasing: "cubicInOut",
        animationDuration: 2000,
      },
    ],
  };
}

function DashboardChart({
  option,
  className = "h-[350px]",
}: {
  option: EChartsCoreOption;
  className?: string;
}) {
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      notMerge
      lazyUpdate
      theme="macarons"
      className={className}
      style={{ width: "100%" }}
    />
  );
}

function PanelGroup({
  data,
  selectedType,
  onSelect,
}: {
  data: PanelGroupData;
  selectedType: number;
  onSelect: (type: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {cardDefinitions.map((card) => {
        const Icon = card.icon;
        const value = data[card.key];
        const active = selectedType === card.type;

        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onSelect(card.type)}
            className={`group flex min-h-[108px] items-center justify-between rounded bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              active ? "ring-2 ring-[#3888fa]/40" : ""
            }`}
          >
            <span
              className="flex h-14 w-14 items-center justify-center rounded-lg transition group-hover:text-white"
              style={{
                color: card.color,
                backgroundColor: active ? `${card.color}20` : "transparent",
              }}
            >
              <Icon className="h-8 w-8" />
            </span>
            <span className="flex min-w-0 flex-col items-end">
              <span className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                {card.label}
              </span>
              <span
                className="mt-2 text-2xl font-bold text-slate-700 transition-all"
                style={{ transitionDuration: card.duration }}
              >
                {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function DashboardPage() {
  const [panelGroupData, setPanelGroupData] = useState<PanelGroupData>({
    totalAccountCount: 0,
    totalPurchaseTimes: 0,
    totalPurchaseUnit: 0,
    totalPurchaseMoney: 0,
  });
  const [selectedTopType, setSelectedTopType] = useState(3);
  const [topChart, setTopChart] = useState<DashboardSeries>(emptySeries);
  const [dailyConsumption, setDailyConsumption] = useState<DashboardSeries>(emptySeries);
  const [successRate, setSuccessRate] = useState<DashboardSeries>(emptySeries);
  const [abnormalAlarm, setAbnormalAlarm] = useState<DashboardSeries>(emptySeries);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const readChart = useCallback(async (type: number, days: number) => {
    return toSeries(
      await apiClient.dashboard.readLineChart({
        from: "2000-01-01T00:00:00.000Z",
        to: new Date().toISOString(),
        type,
        days,
      }),
    );
  }, []);

  const loadTopChart = useCallback(
    async (type: number) => {
      setSelectedTopType(type);
      setTopChart(await readChart(type, 30));
    },
    [readChart],
  );

  const refreshDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [panel, top, consumption, success, alarm] = await Promise.all([
        apiClient.dashboard.readPanelGroup(),
        readChart(selectedTopType, 30),
        readChart(4, 30),
        readChart(6, 48),
        readChart(7, 1),
      ]);

      setPanelGroupData(panel);
      setTopChart(top);
      setDailyConsumption(consumption);
      setSuccessRate(success);
      setAbnormalAlarm(alarm);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [readChart, selectedTopType]);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  const topOption = useMemo(
    () => createBarOption(topChart, chartTitles[selectedTopType] ?? "Purchase Money"),
    [selectedTopType, topChart],
  );
  const consumptionOption = useMemo(
    () => createBarOption(dailyConsumption, "Daily Consumption"),
    [dailyConsumption],
  );
  const successOption = useMemo(
    () => createLineOption(successRate, "Communication Success Rate"),
    [successRate],
  );
  const abnormalOption = useMemo(
    () => createPieOption(abnormalAlarm, "Abnormal Alarm"),
    [abnormalAlarm],
  );

  return (
    <div className="min-h-full bg-[#f0f2f5] p-5 text-slate-700">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            AMR panel group and live chart overview, wired to the original dashboard API.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshDashboard()}
          className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-[#3888fa] hover:text-[#3888fa]"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mb-5 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <PanelGroup
        data={panelGroupData}
        selectedType={selectedTopType}
        onSelect={(type) => void loadTopChart(type)}
      />

      <section className="mt-8 rounded bg-white px-4 pb-4 pt-4 shadow-sm">
        <DashboardChart option={topOption} />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-2">
        <div className="rounded bg-white p-4 shadow-sm">
          <DashboardChart option={successOption} />
        </div>
        <div className="rounded bg-white p-4 shadow-sm">
          <DashboardChart option={abnormalOption} />
        </div>
      </section>

      <section className="mt-8 rounded bg-white px-4 pb-4 pt-3 shadow-sm">
        <div className="mb-1 flex justify-end">
          <a href="/#/prepay-report/daily-data-meter" className="text-xs text-[#409eff] hover:underline">
            More &gt;
          </a>
        </div>
        <div className="mb-2 inline-flex rounded border border-[#dcdfe6] text-xs">
          <span className="rounded bg-[#409eff] px-3 py-1.5 text-white">Daily</span>
        </div>
        <DashboardChart option={consumptionOption} />
      </section>
    </div>
  );
}
