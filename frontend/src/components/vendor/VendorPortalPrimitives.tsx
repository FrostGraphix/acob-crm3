import type { CSSProperties, ReactNode } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   ACOB CRM3 — Vendor Wallet Design Primitives
   Green/Lemon Financial Theme · Re-exported helpers & UI atoms
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── TYPES ───────────────────────────────────────────────────────────────── */

export type VwBadgeVariant = "success" | "danger" | "warning" | "info" | "lemon" | "gray" | "green" | "purple";
export type VwBtnVariant = "primary" | "lemon" | "danger" | "outline" | "ghost" | "subtle" | "dark";
export type VwBtnSize = "md" | "sm" | "xs";
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
  onClick,
  style,
  type = "button",
}: {
  children: ReactNode;
  variant?: VwBtnVariant;
  size?: VwBtnSize;
  full?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  type?: "button" | "submit" | "reset";
}) {
  return (
    <button
      className={`vw-btn vw-btn--${variant} vw-btn--${size}${full ? " vw-btn--full" : ""}`}
      disabled={disabled}
      onClick={onClick}
      style={style}
      type={type}
    >
      {children}
    </button>
  );
}

/* ─── KPI CARD ────────────────────────────────────────────────────────────── */

export function VwKPI({
  label,
  value,
  sub,
  icon,
  iconBg = "#e6f4e6",
  iconColor = "#008000",
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon?: ReactNode;
  iconBg?: string;
  iconColor?: string;
}) {
  return (
    <div className="vw-kpi">
      <div className="vw-kpi__top">
        <span className="vw-kpi__label">{label}</span>
        {icon ? (
          <div className="vw-kpi__icon" style={{ background: iconBg, color: iconColor }}>
            {icon}
          </div>
        ) : null}
      </div>
      <div className="vw-kpi__value">{value}</div>
      {sub ? <div className="vw-kpi__sub">{sub}</div> : null}
    </div>
  );
}

/* ─── INFO BOX ────────────────────────────────────────────────────────────── */

export function VwInfoBox({
  children,
  type = "info",
  icon,
}: {
  children: ReactNode;
  type?: VwInfoType;
  icon?: ReactNode;
}) {
  return (
    <div className={`vw-infobox vw-infobox--${type}`}>
      {icon ? <span className="vw-infobox__icon">{icon}</span> : null}
      <div>{children}</div>
    </div>
  );
}

/* ─── DIVIDER ─────────────────────────────────────────────────────────────── */

export function VwDivider({ label }: { label?: string }) {
  return (
    <div className="vw-divider">
      <div className="vw-divider__line" />
      {label ? <span className="vw-divider__label">{label}</span> : null}
      {label ? <div className="vw-divider__line" /> : null}
    </div>
  );
}

/* ─── STEP BAR ────────────────────────────────────────────────────────────── */

export function VwStepBar({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <div className="vw-steps">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="vw-step" style={{ flex: i < steps.length - 1 ? 1 : "none" }}>
            <div className="vw-step__content">
              <div
                className={`vw-step__circle ${done ? "vw-step__circle--done" : active ? "vw-step__circle--active" : "vw-step__circle--pending"}`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className={`vw-step__label ${done ? "vw-step__label--done" : active ? "vw-step__label--active" : "vw-step__label--pending"}`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <div className={`vw-step__connector ${done ? "vw-step__connector--done" : "vw-step__connector--pending"}`} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ─── CONFIRM TABLE ───────────────────────────────────────────────────────── */

export function VwConfirmTable({
  rows,
}: {
  rows: Array<{ key: string; value: string; mono?: boolean; primary?: boolean }>;
}) {
  return (
    <div className="vw-confirm-table">
      {rows.map((row) => (
        <div className="vw-confirm-row" key={row.key}>
          <span className="vw-confirm-row__key">{row.key}</span>
          <span
            className={`vw-confirm-row__val${row.mono ? " vw-confirm-row__val--mono" : ""}${row.primary ? " vw-confirm-row__val--primary" : ""}`}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── SURFACE ─────────────────────────────────────────────────────────────── */

export function VwSurface({
  children,
  title,
  action,
  padded = true,
}: {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
  padded?: boolean;
}) {
  return (
    <div className={`vw-surface${padded ? " vw-surface--padded" : ""}`}>
      {title ? (
        <div className="vw-surface__header">
          <span className="vw-surface__title">{title}</span>
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
}: {
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
  subtitle?: string;
  title: string;
}) {
  return (
    <div className="vw-modal-overlay" onClick={onClose}>
      <div className={`vw-modal vw-modal--${size}`} onClick={(e) => e.stopPropagation()}>
        <div className="vw-modal__header">
          <div>
            <div className="vw-modal__title">{title}</div>
            {subtitle ? <div className="vw-modal__subtitle">{subtitle}</div> : null}
          </div>
          <button className="vw-modal__close" onClick={onClose} type="button">
            ✕
          </button>
        </div>
        <div className="vw-modal__body">{children}</div>
        {footer ? <div className="vw-modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ─── LEGACY COMPAT EXPORTS ───────────────────────────────────────────────── */

export interface VendorTableColumn<TRow> {
  key: string;
  label: string;
  render: (row: TRow) => ReactNode;
}

export function VendorStatusBanner({
  reason,
  title,
}: {
  contactLabel?: string;
  reason: string;
  title: string;
}) {
  return (
    <div className="vw-infobox vw-infobox--danger" role="status">
      <div>
        <strong>{title}</strong>
        <p>{reason}</p>
      </div>
    </div>
  );
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
    <div className="vendor-wallet-empty-state" style={{ textAlign: "center", padding: "2rem" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--vw-text)", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--vw-muted)" }}>{description}</div>
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}

export function VendorKeyValueGrid({
  items,
  columns = 2,
}: {
  columns?: 2 | 3;
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 10,
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            background: "var(--vw-bg)",
            borderRadius: 10,
            padding: "12px 14px",
            border: "1px solid var(--vw-border)",
          }}
        >
          <div style={{ fontSize: 10, color: "var(--vw-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, fontWeight: 600 }}>
            {item.label}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--vw-text)" }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function VendorFlowSteps({
  activeStep,
  steps,
}: {
  activeStep: number;
  steps: string[];
}) {
  return <VwStepBar steps={steps} current={activeStep} />;
}

export function VendorDataCard({
  action,
  children,
  description,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="vw-surface vw-surface--padded">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          {eyebrow ? <div style={{ fontSize: 10, color: "var(--vw-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: 4 }}>{eyebrow}</div> : null}
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--vw-text)" }}>{title}</div>
          {description ? <div style={{ fontSize: 12, color: "var(--vw-muted)", marginTop: 2 }}>{description}</div> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function VendorLoadingPanel({ label }: { label: string }) {
  return (
    <div className="vw-surface vw-surface--padded" style={{ textAlign: "center", padding: "2.5rem" }}>
      <div className="vw-spinner vw-spinner--md" style={{ borderColor: "var(--vw-primary)", borderRightColor: "transparent", marginBottom: 12 }} />
      <span style={{ color: "var(--vw-muted)", fontSize: 13 }}>{label}</span>
    </div>
  );
}

export function VendorStatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const variantMap: Record<string, VwBadgeVariant> = {
    neutral: "gray",
    success: "success",
    warning: "warning",
    danger: "danger",
    info: "info",
  };
  return <VwBadge variant={variantMap[tone] || "gray"}>{label}</VwBadge>;
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
