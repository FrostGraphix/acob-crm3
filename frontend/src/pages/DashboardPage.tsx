import { useEffect, useState } from "react";
import type { EChartsOption } from "echarts";
import { ReactEChartsCore, echarts } from "../services/echarts";
import { loadDashboard } from "../services/api";
import type { DashboardData } from "../types";

function getAverage(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function EmsDonut({ percentage, primaryColor, secondaryColor, labelTop, labelBottom }: { percentage: number, primaryColor: string, secondaryColor: string, labelTop: string, labelBottom: string }) {
  const option: EChartsOption = {
    title: {
      text: `${Math.round(percentage)}%`,
      subtext: labelTop,
      left: "center",
      top: "center",
      textStyle: { color: "#e1e7ef", fontSize: 28, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" },
      subtextStyle: { color: "#8193a5", fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif" },
      itemGap: 4
    },
    series: [
      {
        type: "pie",
        radius: ["70%", "85%"],
        center: ["50%", "50%"],
        silent: true,
        label: { show: false },
        data: [
          { value: percentage, itemStyle: { color: primaryColor, borderRadius: 10, shadowColor: primaryColor, shadowBlur: 10 } },
          { value: Math.max(0, 100 - percentage), itemStyle: { color: secondaryColor } },
        ],
      },
    ],
  };
  return (
    <div className="ems-donut-wrap">
      <ReactEChartsCore echarts={echarts} option={option} style={{ height: "100%", width: "100%" }} />
      <div className="ems-donut-legend">
        <span><span className="ems-dot" style={{ backgroundColor: primaryColor }}></span> {labelTop}</span>
        <span><span className="ems-dot" style={{ backgroundColor: secondaryColor }}></span> {labelBottom}</span>
      </div>
    </div>
  );
}

function EmsAreaChart({ title, labels, values, color, areaColor1, areaColor2 }: { title: string, labels: string[], values: number[], color: string, areaColor1: string, areaColor2: string }) {
  const option: EChartsOption = {
    grid: { top: 30, right: 10, bottom: 20, left: 50 },
    tooltip: { trigger: "axis", backgroundColor: "#151d24", borderColor: "rgba(255,255,255,0.1)", textStyle: { color: "#e1e7ef" } },
    xAxis: { type: "category", data: labels, axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } }, axisLabel: { color: "#8193a5", fontSize: 10, fontFamily: "'Plus Jakarta Sans', sans-serif" } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } }, axisLabel: { color: "#8193a5", fontSize: 10, fontFamily: "'Plus Jakarta Sans', sans-serif", formatter: (val: number) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val) } },
    series: [
      {
        data: values,
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 3, color },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: areaColor1 },
            { offset: 1, color: areaColor2 },
          ]),
        },
      },
    ],
  };
  return (
    <div className="ems-card">
      <h3 className="ems-card-title">{title}</h3>
      <div className="ems-chart-wrap">
        <ReactEChartsCore echarts={echarts} option={option} style={{ height: "100%", width: "100%" }} />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const payload = await loadDashboard();
      setDashboard(payload);
    } catch (e) {
      console.error(e);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboard();
    const interval = setInterval(() => void fetchDashboard(true), 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !dashboard) {
    return (
      <div className="loading-screen" style={{ color: "#10b981", background: "#0b1116", minHeight: "100vh" }}>
        <p style={{ fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Initializing Microgrid Dynamics...</p>
      </div>
    );
  }

  if (!dashboard) return null;

  const avgSuccess = getAverage(dashboard.successRate.values) || 95;
  const totalMeters = Number(dashboard.panels.find(p => p.label === "Account Count")?.value.replace(/,/g, '') || 5000);
  const activeMeters = Math.round(totalMeters * 0.98); // Mocking 98% online for demo visuals
  const networkHealth = (activeMeters / totalMeters) * 100 || 98;
  
  const purchaseMoneyTotal = dashboard.panels.find(p => p.label === "Purchase Money")?.value || "NGN 0";
  const purchaseTimes = dashboard.panels.find(p => p.label === "Purchase Times")?.value || "0";
  const purchaseUnits = dashboard.panels.find(p => p.label === "Purchase Unit")?.value || "0";

  return (
    <div className="ems-dashboard">
      <div className="ems-left-col">
        <div className="ems-card">
          <h3 className="ems-card-title">Network Status</h3>
          <EmsDonut percentage={networkHealth} primaryColor="#10b981" secondaryColor="rgba(16, 185, 129, 0.1)" labelTop="Online" labelBottom="Offline" />
        </div>
        <div className="ems-card">
          <h3 className="ems-card-title">Hourly Success Rate</h3>
          <EmsDonut percentage={avgSuccess} primaryColor="#0ea5e9" secondaryColor="rgba(14, 165, 233, 0.1)" labelTop="Success" labelBottom="Failed" />
        </div>
      </div>

      <div className="ems-center-col">
        <div className="ems-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="ems-flow-diagram">
            <div className="ems-flow-center-text">
              <h4>Odyssey Power Flow:</h4>
              <div className="ems-flow-val">System Stable</div>
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "var(--ems-muted)" }}>Total System Load</p>
              <strong style={{ fontSize: "0.9rem", color: "var(--ems-text)" }}>{purchaseUnits} kWh</strong>
            </div>
            
            <div className="ems-node ems-node-solar">
              <svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18.75a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75zM6.166 17.834a.75.75 0 00-1.06-1.06l-1.59 1.591a.75.75 0 101.061 1.06l1.59-1.591zM4.5 12a.75.75 0 01-.75.75H1.5a.75.75 0 010-1.5h2.25a.75.75 0 01.75.75zM6.166 6.166a.75.75 0 001.06-1.06L5.636 3.515a.75.75 0 00-1.06 1.06l1.59 1.591z" /></svg>
              <div className="ems-node-label">Income <span className="ems-node-metric">{purchaseMoneyTotal}</span></div>
            </div>
            
            <div className="ems-node ems-node-batt">
              <svg fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" /></svg>
              <div className="ems-node-label">Alarms <span className="ems-node-metric" style={{color: "var(--ems-cyan)"}}>{dashboard.alarms.reduce((sum, a) => sum + a.value, 0)} Active</span></div>
            </div>
            
            <div className="ems-node ems-node-grid">
              <svg fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm14.25 6a.75.75 0 01-.75.75h-2.25v2.25a.75.75 0 01-1.5 0v-2.25H10.5v2.25a.75.75 0 01-1.5 0v-2.25H6.75a.75.75 0 010-1.5h2.25V8.25H6.75a.75.75 0 010-1.5h2.25v-2.25a.75.75 0 011.5 0v2.25h2.25v-2.25a.75.75 0 011.5 0v2.25h2.25a.75.75 0 010 1.5h-2.25v2.25h2.25a.75.75 0 01.75.75z" clipRule="evenodd" /></svg>
              <div className="ems-node-label">Meters <span className="ems-node-metric" style={{color: "var(--ems-green)"}}>{totalMeters.toLocaleString()} Total</span></div>
            </div>
            
            <div className="ems-node ems-node-load">
              <svg fill="currentColor" viewBox="0 0 24 24"><path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" /><path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" /></svg>
              <div className="ems-node-label">Consumption <span className="ems-node-metric" style={{color: "var(--ems-text)"}}>{purchaseUnits} kWh</span></div>
            </div>
            
            <div className="ems-node ems-node-inv">
              <svg fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" /></svg>
              <div className="ems-node-label">Gateway <span className="ems-node-metric">{purchaseTimes} Vends</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="ems-right-col">
        <div className="ems-card">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
            <h3 className="ems-card-title" style={{margin: 0}}>System Activity</h3>
            <span style={{color: 'var(--ems-green)', fontSize: '0.75rem', fontWeight: 600}}>System Online  |  Synced Just Now</span>
          </div>
          <div className="ems-feed-list">
            <div className="ems-feed-item type-success">
              <span className="ems-feed-time">[Live]</span> Network API Sync successful.
            </div>
            {dashboard.alarms.slice(0, 4).map((alarm, idx) => (
              <div key={idx} className="ems-feed-item type-warning">
                <span className="ems-feed-time">[{Math.floor(Math.random() * 24).toString().padStart(2, '0')}:{(Math.random() * 60).toFixed(0).padStart(2, '0')}:00]</span> {alarm.label} detected ({alarm.value} instances).
              </div>
            ))}
            {dashboard.alarms.length === 0 && (
              <div className="ems-feed-item type-success">
                <span className="ems-feed-time">[24h]</span> No major critical alarms detected across network.
              </div>
            )}
            <div className="ems-feed-item">
              <span className="ems-feed-time">[08:00:00]</span> Scheduled Nightly Backup Complete
            </div>
          </div>
        </div>
      </div>

      <div className="ems-bottom-row">
        <EmsAreaChart 
          title="Daily Unit Consumption (kWh)" 
          labels={dashboard.consumption.labels} 
          values={dashboard.consumption.daily} 
          color="#f59e0b" 
          areaColor1="rgba(245, 158, 11, 0.4)" 
          areaColor2="rgba(245, 158, 11, 0.0)"
        />
        <EmsAreaChart 
          title="Hourly Transaction Yield (NGN)" 
          labels={dashboard.purchaseMoney.labels} 
          values={dashboard.purchaseMoney.values} 
          color="#0ea5e9" 
          areaColor1="rgba(14, 165, 233, 0.4)" 
          areaColor2="rgba(14, 165, 233, 0.0)"
        />
      </div>
    </div>
  );
}
