import { useEffect, useState } from "react";
import { loadDashboard } from "../services/api";
import type { DashboardData } from "../types";
import { DualConsumptionChart } from "../components/charts/DualConsumptionChart";

function PremiumStatCard({ 
  label, 
  value, 
  subtext, 
  icon, 
  accent 
}: { 
  label: string, 
  value: string | number, 
  subtext?: string, 
  icon: React.ReactNode, 
  accent: "emerald" | "sapphire" | "amber" | "amethyst" 
}) {
  return (
    <div className="premium-card">
      <div className="stat-content">
        <div className="stat-info">
          <span className="stat-label-tiny">{label}</span>
          <strong className="stat-value-huge">{value}</strong>
          {subtext && <span className="stat-subtext">{subtext}</span>}
        </div>
        <div className={`stat-icon-square ${accent}`}>
          {icon}
        </div>
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
      <div className="loading-screen" style={{ color: "var(--acob-green)", background: "var(--bg-app)", minHeight: "100vh" }}>
        <p style={{ fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Initializing Odyssey CRM3...</p>
      </div>
    );
  }

  if (!dashboard) return null;

  // Map data from dashboard payload
  const purchaseMoneyTotal = dashboard.panels.find(p => p.label === "Purchase Money")?.value || "NGN 0";
  const purchaseUnits = dashboard.panels.find(p => p.label === "Purchase Unit")?.value || "0";
  const totalMeters = dashboard.panels.find(p => p.label === "Account Count")?.value || "0";
  
  // Mocking Night usage for the dual chart demo (as seen in Image 4)
  const dayUsage = dashboard.consumption.daily;
  const nightUsage = dayUsage.map(v => Math.max(0, v * (0.6 + Math.random() * 0.4)));

  return (
    <div className="premium-dashboard">

      <div className="premium-stat-grid">
        <PremiumStatCard 
          label="Total Stocked" 
          value="12,605" 
          subtext="Generated this month"
          accent="emerald"
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
        />
        <PremiumStatCard 
          label="Total Revenue" 
          value={purchaseMoneyTotal} 
          subtext="Income collection"
          accent="sapphire"
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>}
        />
        <PremiumStatCard 
          label="Energy Consumed" 
          value={`${purchaseUnits} kWh`} 
          subtext="Total load loss"
          accent="amethyst"
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>}
        />
        <PremiumStatCard 
          label="Active Meters" 
          value={totalMeters} 
          accent="amber"
          subtext="Network footprint"
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>}
        />
      </div>

      <div className="premium-chart-grid">
        <DualConsumptionChart 
          labels={dashboard.consumption.labels}
          dayValues={dayUsage}
          nightValues={nightUsage}
        />
        
        <div className="premium-chart-card">
          <div className="chart-header">
            <h3 className="chart-title">Revenue by Site</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Top 5 Sites • Last 30 Days</span>
          </div>
          {/* Reusing existing EmsAreaChart logic or simple bar placeholder for now */}
          <div style={{ height: '300px', display: 'flex', alignItems: 'flex-end', gap: '1rem', padding: '0 1rem' }}>
            <div style={{ flex: 1, background: 'var(--emerald)', height: '30%', borderRadius: '4px 4px 0 0', position: 'relative' }}><span style={{ position: 'absolute', bottom: '-20px', left: 0, fontSize: '10px' }}>Site A</span></div>
            <div style={{ flex: 1, background: 'var(--sapphire)', height: '45%', borderRadius: '4px 4px 0 0', position: 'relative' }}><span style={{ position: 'absolute', bottom: '-20px', left: 0, fontSize: '10px' }}>Site B</span></div>
            <div style={{ flex: 1, background: 'var(--amber)', height: '90%', borderRadius: '4px 4px 0 0', position: 'relative' }}><span style={{ position: 'absolute', bottom: '-20px', left: 0, fontSize: '10px' }}>Site C</span></div>
            <div style={{ flex: 1, background: 'var(--amethyst)', height: '70%', borderRadius: '4px 4px 0 0', position: 'relative' }}><span style={{ position: 'absolute', bottom: '-20px', left: 0, fontSize: '10px' }}>Site D</span></div>
            <div style={{ flex: 1, background: '#ef4444', height: '40%', borderRadius: '4px 4px 0 0', position: 'relative' }}><span style={{ position: 'absolute', bottom: '-20px', left: 0, fontSize: '10px' }}>Site E</span></div>
          </div>
        </div>
      </div>
      
      <div className="premium-card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="chart-title">System Activity</h3>
          <span style={{ color: 'var(--emerald)', fontSize: '0.75rem', fontWeight: 600 }}>SYNCED JUST NOW</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: '3px solid var(--emerald)', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>[Live]</span> STS Gateway token generation sequence finalized.
          </div>
          <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: '3px solid var(--amber)', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>[09:20]</span> Network Sync: 12 legacy meters updated to STS phase 2.
          </div>
        </div>
      </div>
    </div>
  );
}

