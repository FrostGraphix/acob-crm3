import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../services/api";
import type {
  CreditTokenRecord,
  DashboardData,
  HourlyMeterData,
  SiteId,
} from "../../../common/types/odyssey";

type DashboardCharts = {
  purchaseMoney: { xData: string[]; yData: number[] };
  hourlySuccess: { xData: string[]; yData: number[] };
  abnormalAlarm: { xData: string[]; yData: number[] };
  dailyConsumption: { xData: string[]; yData: number[] };
  trendOverview: { xData: string[]; yData: number[] };
};

export type DashboardViewData = DashboardData & {
  charts: DashboardCharts;
};

function emptyChart() {
  return { xData: [], yData: [] };
}

function useAsync<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetcher();
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useDashboard(from: string, to: string, siteId?: SiteId) {
  const fetchDashboard = useCallback(async () => {
    const params = { from, to, ...(siteId ? { siteId } : {}) };

    const [dashboard, purchaseMoney, hourlySuccess, abnormalAlarm, dailyConsumption, trendOverview] = await Promise.all([
      apiClient.getDashboard(from, to, siteId),
      apiClient.dashboard.readLineChart({ ...params, type: 1 }).catch(() => emptyChart()),
      apiClient.dashboard.readLineChart({ ...params, type: 2 }).catch(() => emptyChart()),
      apiClient.dashboard.readLineChart({ ...params, type: 3 }).catch(() => emptyChart()),
      apiClient.dashboard.readLineChart({ ...params, type: 4 }).catch(() => emptyChart()),
      apiClient.dashboard.readLineChart({ ...params, type: 0 }).catch(() => emptyChart()),
    ]);

    return {
      ...dashboard,
      charts: {
        purchaseMoney,
        hourlySuccess,
        abnormalAlarm,
        dailyConsumption,
        trendOverview,
      },
    };
  }, [from, to, siteId]);

  return useAsync<DashboardViewData>(fetchDashboard);
}

export function useTokenRecords(siteId: SiteId | "ALL", from: string, to: string) {
  const fetchTokenRecords = useCallback(
    () => apiClient.getTokenRecords(siteId, from, to),
    [siteId, from, to],
  );

  return useAsync<CreditTokenRecord[]>(fetchTokenRecords);
}

export function useHourlyData(siteId: SiteId | "ALL", from: string, to: string) {
  const fetchHourlyData = useCallback(
    () => apiClient.getHourlyData(siteId, from, to),
    [siteId, from, to],
  );

  return useAsync<HourlyMeterData[]>(fetchHourlyData);
}

export function useGprsStatus() {
  const fetchGprsStatus = useCallback(() => apiClient.getGprsStatus(), []);

  return useAsync(fetchGprsStatus);
}
