import type { DataPageConfig } from "../types/index.ts";

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createInitialFilters(page: DataPageConfig, today = new Date()) {
  return page.filters.reduce<Record<string, string>>((accumulator, filter) => {
    if (filter.key === "fromDate" && filter.type === "date") {
      accumulator[filter.key] = "2025-01-01";
      return accumulator;
    }

    if (filter.key === "toDate" && filter.type === "date") {
      accumulator[filter.key] = formatLocalDate(today);
      return accumulator;
    }

    accumulator[filter.key] = "";
    return accumulator;
  }, {});
}
