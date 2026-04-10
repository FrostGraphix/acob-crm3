export const SITES = ["KYAKALE", "MUSHA", "UMAISHA", "TUNGA", "OGUFA"] as const;
export type SiteId = typeof SITES[number];

export interface CreditTokenRecord {
  id: string;
  meterSN: string;
  tokenValue: string;
  amount: number;
  energyUnits?: number;
  kwh?: number;
  timestamp: string;
  customerId?: string;
  customerName?: string;
  accountNo?: string;
  tariffRate?: string;
  siteId: SiteId;
  operatorId?: string;
  status?: "ACTIVE" | "USED" | "CANCELLED";
}

export interface HourlyMeterData {
  id: string;
  meterSN: string;
  timestamp: string;
  hour: number;
  activeEnergyImport: number;
  activeEnergyExport: number;
  reactiveEnergyImport: number;
  reactiveEnergyExport: number;
  voltage?: number;
  current?: number;
  powerFactor?: number;
  siteId: SiteId;
}

export interface EventNotification {
  id: string;
  meterSN: string;
  eventType: string;
  timestamp: string;
  siteId: SiteId;
  description?: string;
  acknowledged: boolean;
}

export interface FlowMetrics {
  solarToInverterKw: number;
  inverterToBatteryKw: number;
  batteryToInverterKw: number;
  inverterToLoadKw: number;
  gridToInverterKw: number;
  inverterToGridKw: number;
  generatorToInverterKw: number;
}

export interface GenerationStats {
  pvYield: number;
  loadConsumption: number;
  gridImport: number;
  gridExport: number;
  batteryDischarge: number;
  batteryCharge: number;
}

export interface SiteMetadata {
  siteId: SiteId;
  name: string;
  pvCapacityKw: number;
  batteryCapacityKwh: number;
  inverterCapacityKw: number;
  isOnline: boolean;
  weather: {
    temp: number;
    condition: string;
    icon: string;
  };
}

export interface DashboardData {
  sites: Array<Record<string, unknown>>;
  portfolioRevenue: number;
  portfolioEnergyKwh: number;
  portfolioActiveMeters: number;
  recentTokens: CreditTokenRecord[];
  recentEvents: EventNotification[];
  lastUpdated: string;
  accountCount: number;
  purchaseTimes: number;
  purchaseUnit: number;
  purchaseMoney: number;
  selectedSiteMetadata?: SiteMetadata;
  flow?: FlowMetrics;
  generation?: GenerationStats;
  hourlyGeneration?: Array<{
    timestamp: string;
    pv: number;
    load: number;
    battery: number;
    grid: number;
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
