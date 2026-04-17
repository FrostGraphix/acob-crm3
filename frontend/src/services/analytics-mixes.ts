import type { AnalyticsMixResponse } from "../../../common/types/index";
import { request } from "./api";

function normalizeQuery(query: Record<string, string>) {
  return Object.entries(query).reduce<Record<string, string>>((accumulator, [key, value]) => {
    if (value.trim().length > 0) {
      accumulator[key] = value;
    }

    return accumulator;
  }, {});
}

export async function loadAnalyticsMix(
  endpoint: string,
  query: Record<string, string> = {},
): Promise<AnalyticsMixResponse> {
  return request<AnalyticsMixResponse>(endpoint, {
    method: "GET",
    query: normalizeQuery(query),
  });
}
