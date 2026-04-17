import { VwBadge } from "./VendorPortalPrimitives.tsx";

import { getStatusTone } from "./VendorPortalUtils";

export function StatusMessage({
  message,
  tone = "neutral",
}: {
  message: string | null;
  tone?: "danger" | "neutral" | "success";
}) {
  if (!message) {
    return null;
  }

  const bgMap: Record<string, string> = {
    danger: "var(--vw-danger-bg)",
    success: "var(--vw-success-bg)",
    neutral: "var(--vw-bg)",
  };

  const colorMap: Record<string, string> = {
    danger: "var(--vw-danger-text)",
    success: "var(--vw-success-text)",
    neutral: "var(--vw-muted)",
  };

  return (
    <p style={{
      margin: 0,
      padding: "8px 14px",
      borderRadius: 8,
      background: bgMap[tone] ?? bgMap.neutral,
      color: colorMap[tone] ?? colorMap.neutral,
      fontSize: 13,
      fontFamily: "var(--vw-font)",
    }}>
      {message}
    </p>
  );
}

export function StatusBadge({ label }: { label: string }) {
  return <VwBadge variant={getStatusTone(label)} dot>{label}</VwBadge>;
}
