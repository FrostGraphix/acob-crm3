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
};

export type DashboardViewData = DashboardData & {
  charts: DashboardCharts;
};

function emptyChart() {
  return { xData: [], yData: [] };
}

function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
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
  }, deps);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useDashboard(from: string, to: string, siteId?: SiteId) {
  return useAsync<DashboardViewData>(async () => {
    const params = { from, to, ...(siteId ? { siteId } : {}) };

    const [dashboard, purchaseMoney, hourlySuccess, abnormalAlarm, dailyConsumption] = await Promise.all([
      apiClient.getDashboard(from, to, siteId),
      apiClient.dashboard.readLineChart({ ...params, type: 1 }).catch(() => emptyChart()),
      apiClient.dashboard.readLineChart({ ...params, type: 2 }).catch(() => emptyChart()),
      apiClient.dashboard.readLineChart({ ...params, type: 3 }).catch(() => emptyChart()),
      apiClient.dashboard.readLineChart({ ...params, type: 4 }).catch(() => emptyChart()),
    ]);

    return {
      ...dashboard,
      charts: {
        purchaseMoney,
        hourlySuccess,
        abnormalAlarm,
        dailyConsumption,
      },
    };
  }, [from, to, siteId]);
}

export function useTokenRecords(siteId: SiteId | "ALL", from: string, to: string) {
  return useAsync<CreditTokenRecord[]>(
    () => apiClient.getTokenRecords(siteId, from, to),
    [siteId, from, to],
  );
}

export function useHourlyData(siteId: SiteId | "ALL", from: string, to: string) {
  return useAsync<HourlyMeterData[]>(
    () => apiClient.getHourlyData(siteId, from, to),
    [siteId, from, to],
  );
}

export function useGprsStatus() {
  return useAsync(() => apiClient.getGprsStatus(), []);
}
