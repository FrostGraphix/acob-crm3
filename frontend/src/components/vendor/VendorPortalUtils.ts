import type { VwBadgeVariant } from "./VendorPortalPrimitives.tsx";

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "--";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-NG", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "Africa/Lagos",
    year: "numeric",
  });
}

export function formatDateOnly(value: string | null | undefined) {
  if (!value) {
    return "--";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    timeZone: "Africa/Lagos",
    year: "numeric",
  });
}

export function formatTokenValue(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\s+/g, "");
  return digits.length > 0 ? digits.replace(/(.{4})/g, "$1 ").trim() : "--";
}

export function getCurrentMonthRange() {
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    fromDate: fromDate.toISOString().slice(0, 10),
    toDate: toDate.toISOString().slice(0, 10),
  };
}

export function getStatusTone(status: string | null | undefined): VwBadgeVariant {
  const normalizedStatus = (status ?? "").toLowerCase();

  if (
    normalizedStatus.includes("active") ||
    normalizedStatus.includes("posted") ||
    normalizedStatus.includes("successful") ||
    normalizedStatus.includes("delivered")
  ) {
    return "success";
  }

  if (
    normalizedStatus.includes("review") ||
    normalizedStatus.includes("pending") ||
    normalizedStatus.includes("reserved") ||
    normalizedStatus.includes("confirmed")
  ) {
    return "warning";
  }

  if (
    normalizedStatus.includes("suspend") ||
    normalizedStatus.includes("frozen") ||
    normalizedStatus.includes("failed") ||
    normalizedStatus.includes("rejected")
  ) {
    return "danger";
  }

  return "gray";
}
