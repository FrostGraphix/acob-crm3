import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { useDashboard } from "../hooks/useOdyssey";
import { cn } from "../lib/utils";
import { SITES, type SiteId } from "../../../common/types/odyssey";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

const PIE_COLORS = ["#22c55e", "#16a34a", "#84cc16", "#4ade80", "#15803d", "#65a30d"];
const CHART_ACCENT = "#22c55e";
const CHART_GRID = "#21412b";
const CHART_TICK = "#8fb39a";
const DEFAULT_FROM = "2000-01-01T00:00:00.000Z";

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const update = () => {
      setSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    update();

    const observer = new ResizeObserver(() => {
      update();
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref, size };
}

function ChartHost({
  heightClassName,
  loading,
  children,
}: {
  heightClassName: string;
  loading: boolean;
  children: (size: { width: number; height: number }) => ReactNode;
}) {
  const { ref, size } = useElementSize<HTMLDivElement>();

  return (
    <div ref={ref} className={`${heightClassName} w-full min-w-0`}>
      {loading ? <div className="h-full w-full shimmer-bg rounded" /> : null}
      {!loading && size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  );
}

function ReferenceStats({
  stats,
  loading,
}: {
  stats: {
    accountCount: number;
    purchaseTimes: number;
    purchaseUnit: number;
    purchaseMoney: number;
  };
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 mb-8 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-24 glass rounded-xl shimmer-bg" />
        ))}
      </div>
    );
  }

  const items = [
    { label: "Account Count", value: stats.accountCount, unit: "", icon: Users, color: "#06D6A0" },
    { label: "Purchase Times", value: stats.purchaseTimes, unit: "", icon: RefreshCw, color: "#22c55e" },
    { label: "Purchase Unit", value: stats.purchaseUnit, unit: "kWh", icon: Zap, color: "#84cc16" },
    { label: "Purchase Money", value: stats.purchaseMoney, unit: "NGN", icon: TrendingUp, color: "#16a34a" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 mb-8 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="glass p-5 rounded-xl border border-odyssey-border/50 flex items-center justify-between group hover:border-odyssey-mid/40 transition-colors shadow-sm cursor-default"
        >
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5">
              {item.label}
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-display font-bold text-white tracking-tight">
                {typeof item.value === "number" && item.unit === "NGN"
                  ? `₦${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : item.value?.toLocaleString() ?? 0}
              </span>
              {item.unit && item.unit !== "NGN" ? (
                <span className="text-xs text-muted-foreground font-medium ml-0.5">{item.unit}</span>
              ) : null}
            </div>
          </div>
          <div
            className="p-3 rounded-xl transition-colors duration-300"
            style={{ backgroundColor: `${item.color}15` }}
          >
            <item.icon
              className="w-5 h-5 transition-transform duration-300 group-hover:scale-110"
              style={{ color: item.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusTicker() {
  const [messages] = useState([
    "UMAISHA: Battery reaching 85% SOC",
    "MUSHA: Solar Generation peaking at 42kW",
    "OGUFA: High consumption detected on Meter 0012",
    "KYAKALE: System health optimal",
    "TUNGA: Communication link stable",
  ]);

  return (
    <div className="glass h-12 rounded-xl mb-8 border border-odyssey-electric/20 flex items-center px-4 overflow-hidden shadow-[0_0_15px_-5px_rgba(34,197,94,0.18)] relative">
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-odyssey-surface to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-odyssey-surface to-transparent z-10" />

      <div className="flex items-center gap-2.5 mr-6 shrink-0 relative z-20 bg-odyssey-surface/80 px-2 py-1 rounded">
        <div className="w-2.5 h-2.5 rounded-full bg-odyssey-electric animate-pulse shadow-[0_0_8px_#06D6A0]" />
        <span className="text-[11px] font-bold text-odyssey-electric uppercase tracking-widest">Live Pulse</span>
      </div>

      <div className="flex-1 w-full overflow-hidden relative z-0">
        <motion.div
          animate={{ x: ["50%", "-100%"] }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          className="whitespace-nowrap flex gap-16"
        >
          {messages.map((message, index) => (
            <span key={`${message}-${index}`} className="text-sm text-white/80 font-mono flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                [{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}]
              </span>
              {message}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

function mapSeries(xData: string[] | undefined, yData: number[] | undefined) {
  if (!xData || !yData) {
    return [];
  }

  return xData.map((x, index) => ({
    name: x,
    value: yData[index] ?? 0,
  }));
}

export function DashboardPage() {
  const [from] = useState(DEFAULT_FROM);
  const [queryWindowEnd, setQueryWindowEnd] = useState(() => new Date().toISOString());
  const [selectedSite, setSelectedSite] = useState<SiteId | "ALL">("ALL");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: dashboardData, loading, error } = useDashboard(
    from,
    queryWindowEnd,
    selectedSite === "ALL" ? undefined : selectedSite,
  );

  useAutoRefresh(() => {
    setQueryWindowEnd(new Date().toISOString());
  });

  useEffect(() => {
    if (!loading) {
      setIsRefreshing(false);
    }
  }, [loading]);

  async function handleRefresh() {
    setIsRefreshing(true);
    setQueryWindowEnd(new Date().toISOString());
  }

  const referenceStats = useMemo(
    () => ({
      accountCount: dashboardData?.accountCount || 0,
      purchaseTimes: dashboardData?.purchaseTimes || 0,
      purchaseUnit: dashboardData?.purchaseUnit || 0,
      purchaseMoney: dashboardData?.purchaseMoney || 0,
    }),
    [dashboardData],
  );

  const purchaseMoneySeries = useMemo(
    () => mapSeries(dashboardData?.charts?.purchaseMoney?.xData, dashboardData?.charts?.purchaseMoney?.yData),
    [dashboardData],
  );
  const hourlySuccessSeries = useMemo(
    () => mapSeries(dashboardData?.charts?.hourlySuccess?.xData, dashboardData?.charts?.hourlySuccess?.yData),
    [dashboardData],
  );
  const abnormalAlarmSeries = useMemo(
    () =>
      mapSeries(dashboardData?.charts?.abnormalAlarm?.xData, dashboardData?.charts?.abnormalAlarm?.yData).filter(
        (entry) => entry.value > 0,
      ),
    [dashboardData],
  );
  const dailyConsumptionSeries = useMemo(
    () => mapSeries(dashboardData?.charts?.dailyConsumption?.xData, dashboardData?.charts?.dailyConsumption?.yData),
    [dashboardData],
  );

  return (
    <div className="dashboard-page dashboard-page--legacy space-y-4 animate-fade-in pb-12 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight flex items-center gap-3">
            {selectedSite === "ALL" ? "Portfolio Overview" : `${selectedSite} Dashboard`}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time energy management & microgrid performance
          </p>
        </div>

        <div className="flex items-center gap-3 bg-black/20 p-1.5 rounded-xl border border-white/5 backdrop-blur-md">
          <select
            value={selectedSite}
            onChange={(event) => setSelectedSite(event.target.value as SiteId | "ALL")}
            className="glass border-none rounded-lg px-4 py-2 text-sm font-semibold text-white bg-transparent focus:outline-none appearance-none cursor-pointer hover:bg-white/5 transition-colors"
          >
            <option value="ALL" className="bg-odyssey-card text-white">
              All Sites (Portfolio)
            </option>
            {SITES.map((site) => (
              <option key={site} value={site} className="bg-odyssey-card text-white">
                {site} Site
              </option>
            ))}
          </select>
          <div className="w-px h-6 bg-white/10 hidden sm:block" />
          <button
            onClick={() => void handleRefresh()}
            className="p-2 lg:px-4 lg:py-2 rounded-lg hover:bg-white/10 transition-colors group flex items-center gap-2"
            disabled={loading || isRefreshing}
          >
            <RefreshCw
              className={cn(
                "w-4 h-4 text-muted-foreground group-hover:text-white transition-all",
                (loading || isRefreshing) && "animate-spin text-odyssey-electric",
              )}
            />
            <span className="hidden lg:block text-sm font-medium text-white/80 group-hover:text-white">
              Refresh
            </span>
          </button>
        </div>
      </div>

      <StatusTicker />

      <ReferenceStats stats={referenceStats} loading={loading} />

      {error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-start gap-4 text-red-500 shadow-lg animate-fade-in">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">Data Retrieval Error</h4>
            <p className="text-sm opacity-90 mt-1">{error}</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-6 animate-fade-in">
        <div className="glass rounded-xl border border-odyssey-border p-6 shadow-sm">
          <div className="flex items-center justify-center mb-4">
            <h3 className="text-lg font-display text-odyssey-electric font-semibold">Purchase Money</h3>
          </div>
          <ChartHost heightClassName="h-[300px]" loading={loading}>
            {({ width, height }) => (
              <BarChart width={width} height={height} data={purchaseMoneySeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: CHART_TICK }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: CHART_TICK }} axisLine={false} tickLine={false} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: "#09120c", borderColor: CHART_GRID, borderRadius: "8px" }}
                  itemStyle={{ color: "#fff" }}
                />
                <Bar dataKey="value" fill={CHART_ACCENT} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            )}
          </ChartHost>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass rounded-xl border border-odyssey-border p-6 shadow-sm">
            <div className="flex items-center justify-center mb-4">
              <h3 className="text-lg font-display text-odyssey-electric font-semibold">Hourly Success Rate</h3>
            </div>
            <ChartHost heightClassName="h-[260px]" loading={loading}>
              {({ width, height }) => (
                <LineChart width={width} height={height} data={hourlySuccessSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: CHART_TICK }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: CHART_TICK }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#09120c", borderColor: CHART_GRID, borderRadius: "8px" }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Line type="monotone" dataKey="value" stroke={CHART_ACCENT} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              )}
            </ChartHost>
          </div>

          <div className="glass rounded-xl border border-odyssey-border p-6 shadow-sm">
            <div className="flex items-center justify-center mb-4">
              <h3 className="text-lg font-display text-odyssey-electric font-semibold">Abnormal Alarm</h3>
            </div>
            <ChartHost heightClassName="h-[260px]" loading={loading}>
              {({ width, height }) => (
                <PieChart width={width} height={height} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={abnormalAlarmSeries}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    fill={CHART_ACCENT}
                    dataKey="value"
                    label={({ name }) => name}
                    labelLine
                  >
                    {abnormalAlarmSeries.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#09120c", borderColor: CHART_GRID, borderRadius: "8px" }}
                    itemStyle={{ color: "#fff" }}
                  />
                </PieChart>
              )}
            </ChartHost>
          </div>
        </div>

        <div className="glass rounded-xl border border-odyssey-border p-6 shadow-sm">
          <div className="flex items-center justify-center mb-4">
            <h3 className="text-lg font-display text-odyssey-electric font-semibold">Daily Consumption</h3>
          </div>
          <ChartHost heightClassName="h-[300px]" loading={loading}>
            {({ width, height }) => (
              <BarChart width={width} height={height} data={dailyConsumptionSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: CHART_TICK }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: CHART_TICK }} axisLine={false} tickLine={false} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: "#09120c", borderColor: CHART_GRID, borderRadius: "8px" }}
                  itemStyle={{ color: "#fff" }}
                />
                <Bar dataKey="value" fill={CHART_ACCENT} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            )}
          </ChartHost>
        </div>
      </div>
    </div>
  );
}
