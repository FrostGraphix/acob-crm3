import type { DataPageConfig } from "../types/index.ts";

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createInitialFilters(page: DataPageConfig, today = new Date()) {
  const startOfYear = `${today.getFullYear()}-01-01`;
  return page.filters.reduce<Record<string, string>>((accumulator, filter) => {
    if (filter.key === "fromDate" && filter.type === "date") {
      accumulator[filter.key] = startOfYear;
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
