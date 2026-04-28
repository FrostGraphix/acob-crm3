import { isValidElement, type CSSProperties, type ReactNode } from "react";
import { 
  AlertCircle, CheckCircle2, Info, X,
  AlertTriangle, TrendingUp, Activity
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   ACOB CRM3 — Wallet Design System Primitives
   Design memory aligned light workspace · Poppins + DM Mono
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── DESIGN TOKENS (Shared) ──────────────────────────────────────────────── */
export const T = {
  sidebar: "#011508",
  sidebarBg: "#011508",
  sidebarMid: "#021f0d",
  sidebarAccent: "#013b18",
  primary: "#008000",
  primaryDark: "#006600",
  primaryLight: "#e6f4e6",
  primaryGlow: "rgba(0, 128, 0, 0.1)",
  lemon: "#C6E000",
  lemonDark: "#A5BB00",
  lemonLight: "#F4FAC2",
  lemonText: "#2B3300",
  bg: "#F2F4F2",
  card: "#FFFFFF",
  surface: "#FFFFFF",
  surface2: "#FAFBFA",
  border: "#E5EAE5",
  border2: "#D1D8D1",
  text: "#0d1f10",
  textMid: "#374151",
  muted: "#6B7280",
  faint: "#9CA3AF",
  glass: "rgba(242, 244, 242, 0.78)",
  success: "#008000",
  successBg: "#e6f4e6",
  successText: "#014d01",
  danger: "#DC2626",
  dangerBg: "#FEF2F2",
  dangerText: "#991B1B",
  warning: "#D97706",
  warningBg: "#FFFBEB",
  warningText: "#92400E",
  info: "#2563EB",
  infoBg: "#EFF6FF",
  infoText: "#1E40AF",
  purpleBg: "#F5F3FF",
  purpleText: "#5B21B6",
  font: "'Poppins', sans-serif",
  mono: "'DM Mono', monospace",
};

export type VwBadgeVariant = "success" | "danger" | "warning" | "info" | "lemon" | "gray" | "green" | "purple";
export type VwBtnVariant = "primary" | "lemon" | "danger" | "outline" | "ghost" | "subtle" | "dark";
export type VwBtnSize = "lg" | "md" | "sm" | "xs";
export type VwInfoType = "info" | "warning" | "success" | "danger" | "lemon";

/* ─── FORMAT ──────────────────────────────────────────────────────────────── */
export function NGN(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(value);
}

/* ─── BADGE ───────────────────────────────────────────────────────────────── */
export function VwBadge({
  children,
  variant = "gray",
  dot = false,
  lg = false,
}: {
  children: ReactNode;
  variant?: VwBadgeVariant;
  dot?: boolean;
  lg?: boolean;
}) {
  return (
    <span className={`vw-badge vw-badge--${variant}${lg ? " vw-badge--lg" : ""}`}>
      {dot ? <span className="vw-badge__dot" /> : null}
      {children}
    </span>
  );
}

/* ─── BUTTON ──────────────────────────────────────────────────────────────── */
export function VwBtn({
  children,
  variant = "primary",
  size = "md",
  full = false,
  disabled = false,
  loading = false,
  onClick,
  style,
  type = "button",
  icon: Icon,
}: {
  children: ReactNode;
  variant?: VwBtnVariant;
  size?: VwBtnSize;
  full?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  type?: "button" | "submit" | "reset";
  icon?: any;
}) {
  return (
    <button
      className={`vw-btn vw-btn--${variant} vw-btn--${size}${full ? " vw-btn--full" : ""}`}
      disabled={disabled || loading}
      onClick={onClick}
      style={style}
      type={type}
    >
      {Icon && <Icon size={size === "xs" ? 12 : size === "sm" ? 14 : size === "lg" ? 18 : 16} />}
      {children}
    </button>
  );
}

/* ─── KPI CARD ────────────────────────────────────────────────────────────── */
export function VwKPI({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  iconBg,
  valueColor,
  tone = "gray",
  dot = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: any;
  trend?: string;
  iconBg?: string;
  valueColor?: string;
  tone?: "success" | "danger" | "warning" | "info" | "gray";
  dot?: boolean;
}) {
  const toneMap = {
    success: { value: T.success, dot: T.success },
    danger: { value: T.danger, dot: T.danger },
    warning: { value: T.warning, dot: T.warning },
    info: { value: T.info, dot: T.info },
    gray: { value: T.text, dot: T.faint },
  };
  const resolvedTone = toneMap[tone];

  return (
    <div className="vw-kpi">
      <div className="vw-kpi__top">
        <span className="vw-kpi__label">{label}</span>
        {Icon ? (
          <div className="vw-kpi__icon" style={iconBg ? { background: iconBg } : undefined}>
            <Icon size={18} />
          </div>
        ) : null}
      </div>
      <div className="vw-kpi__value" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <div className="vw-kpi__sub" style={dot ? { display: "inline-flex", alignItems: "center", gap: 6 } : undefined}>
          {dot ? (
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: resolvedTone.dot,
                flexShrink: 0,
              }}
            />
          ) : null}
          {sub}
        </div>
        {trend && (
          <div style={{ fontSize: 10, color: T.primary, display: "flex", alignItems: "center", gap: 3, fontWeight: 700 }}>
            <TrendingUp size={10} />
            {trend}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── INFO BOX ────────────────────────────────────────────────────────────── */
export function VwInfoBox({
  children,
  type = "info",
  icon: Icon,
}: {
  children: ReactNode;
  type?: VwInfoType;
  icon?: ReactNode | any;
}) {
  const FallbackIcon = type === "danger" ? AlertTriangle : type === "warning" ? AlertCircle : Info;
  const IconComponent = typeof Icon === "function" ? Icon : null;

  return (
    <div className={`vw-infobox vw-infobox--${type}`}>
      <span className="vw-infobox__icon">
        {isValidElement(Icon) ? Icon : IconComponent ? <IconComponent size={16} /> : <FallbackIcon size={16} />}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

/* ─── SURFACE / PANEL ─────────────────────────────────────────────────────── */
export function VwSurface({
  children,
  title,
  action,
  padded = true,
  icon: Icon,
}: {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
  padded?: boolean;
  icon?: any;
}) {
  return (
    <div className={`vw-surface${padded ? " vw-surface--padded" : ""}`}>
      {title ? (
        <div className="vw-surface__header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {Icon && <Icon size={16} style={{ color: T.primary }} />}
            <span className="vw-surface__title">{title}</span>
          </div>
          {action ? action : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/* ─── MODAL ───────────────────────────────────────────────────────────────── */
export function VwModal({
  children,
  footer,
  onClose,
  size = "md",
  subtitle,
  title,
  open
}: {
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
  subtitle?: string;
  title: string;
  open: boolean;
}) {
  if (!open) return null;

  const maxWidths = { sm: "400px", md: "560px", lg: "800px" };

  return (
    <div 
      className="vw-modal-overlay vw-fadeIn" 
      onClick={onClose}
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 20
      }}
    >
      <div 
        className="vw-fadeUp"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(165deg, #121814, #080C0A)",
          borderRadius: 24, border: `1px solid ${T.border}`,
          width: "100%", maxWidth: maxWidths[size],
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          maxHeight: "90vh", display: "flex", flexDirection: "column"
        }}
      >
        <div style={{ padding: "24px 28px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: -0.3 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{subtitle}</div>}
          </div>
          <button 
            onClick={onClose}
            style={{ 
              background: T.glass, border: `1px solid ${T.border}`, color: T.muted,
              width: 32, height: 32, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer"
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: "28px", overflowY: "auto", flex: 1 }}>{children}</div>
        {footer && (
          <div style={{ padding: "20px 28px", borderTop: `1px solid ${T.border}`, background: "rgba(0,0,0,0.2)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── FORM FIELDS ─────────────────────────────────────────────────────────── */
export const VwFI = ({ label, ...props }: any) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</label>}
    <input
      {...props}
      style={{
        width: "100%", background: T.glass, border: `1px solid ${T.border}`, 
        borderRadius: 12, padding: "12px 16px", color: "#fff", fontSize: 14,
        fontFamily: T.font, outline: "none", transition: "all 0.2s"
      }}
      onFocus={(e) => {
        e.target.style.borderColor = T.primary;
        e.target.style.boxShadow = `0 0 0 4px ${T.primary}22`;
      }}
      onBlur={(e) => {
        e.target.style.borderColor = T.border;
        e.target.style.boxShadow = "none";
      }}
    />
  </div>
);

/* ─── DIVIDER ─────────────────────────────────────────────────────────────── */
export function VwDivider({ label }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "24px 0" }}>
      <div style={{ flex: 1, height: 1, background: T.border }} />
      {label && <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>}
      {label && <div style={{ flex: 1, height: 1, background: T.border }} />}
    </div>
  );
}

/* ─── STEP BAR ────────────────────────────────────────────────────────────── */
export function VwStepBar({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
      {steps.map((step, i) => (
        <React.Fragment key={step}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div 
              style={{ 
                width: 24, height: 24, borderRadius: 8, 
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800,
                background: i <= current ? T.primary : T.glass,
                color: i <= current ? "#000" : T.muted,
                border: i <= current ? "none" : `1px solid ${T.border}`
              }}
            >
              {i < current ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <span style={{ fontSize: 12, fontWeight: i === current ? 700 : 400, color: i === current ? "#fff" : T.muted }}>
              {step}
            </span>
          </div>
          {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: i < current ? T.primary : T.border }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ─── CONFIRM TABLE ───────────────────────────────────────────────────────── */
export function VwConfirmTable({ rows }: { rows: Array<{ key: string; value: string; mono?: boolean; primary?: boolean }> }) {
  return (
    <div style={{ borderRadius: 18, border: `1px solid ${T.border}`, overflow: "hidden", background: "rgba(0,0,0,0.2)" }}>
      {rows.map((row, i) => (
        <div 
          key={row.key} 
          style={{ 
            display: "flex", justifyContent: "space-between", padding: "14px 20px",
            borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : "none",
            background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)"
          }}
        >
          <span style={{ fontSize: 13, color: T.muted }}>{row.key}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: row.primary ? T.primary : "#fff", fontFamily: row.mono ? T.mono : T.font }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

import React from "react";

/* ─── LEGACY COMPAT EXPORTS ───────────────────────────────────────────────── */
export interface VendorTableColumn<TRow> {
  key: string;
  label: string;
  render: (row: TRow) => ReactNode;
}

export function VendorEmptyState({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="vendor-wallet-empty-state" style={{ textAlign: "center", padding: "3rem 2rem", background: T.glass, borderRadius: 20, border: `1px dashed ${T.border}` }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: T.muted, maxWidth: 300, margin: "0 auto" }}>{description}</div>
      {action ? <div style={{ marginTop: 20 }}>{action}</div> : null}
    </div>
  );
}

export function VendorLoadingPanel({ label }: { label: string }) {
  return (
    <div className="vw-surface vw-surface--padded" style={{ textAlign: "center", padding: "4rem 2rem" }}>
      <Activity size={32} className="vw-pulse" style={{ color: T.primary, marginBottom: 16 }} />
      <div style={{ color: T.muted, fontSize: 14, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

export function VendorTable<TRow>({
  columns,
  emptyDescription,
  emptyTitle,
  rows,
}: {
  columns: VendorTableColumn<TRow>[];
  emptyDescription: string;
  emptyTitle: string;
  rows: TRow[];
}) {
  if (rows.length === 0) {
    return <VendorEmptyState description={emptyDescription} title={emptyTitle} />;
  }

  return (
    <div className="vw-table-wrap">
      <table className="vw-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function VendorKeyValueGrid({
  columns = 2,
  items,
}: {
  columns?: number;
  items: Array<{ key?: string; label?: string; value: ReactNode; mono?: boolean }>;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 12 }}>
      {items.map((item) => (
        <div
          key={item.key ?? item.label ?? String(item.value)}
          style={{
            background: T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: "12px 14px",
          }}
        >
          <div style={{ fontSize: 10, color: T.faint, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: 5 }}>
            {item.key ?? item.label ?? "--"}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: item.mono ? T.mono : T.font }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
