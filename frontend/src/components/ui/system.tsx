import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ElementType,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function getColumnHeaderText(header: ReactNode, fallback: string) {
  if (typeof header === "string" && header.trim().length > 0) {
    return header;
  }

  if (typeof header === "number") {
    return String(header);
  }

  return fallback;
}

type SurfaceTone = "default" | "muted" | "accent" | "danger" | "ghost";
type SurfacePadding = "none" | "sm" | "md" | "lg";
type ButtonVariant = "primary" | "secondary" | "ghost" | "subtle" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";
type BadgeTone = "neutral" | "accent" | "info" | "warning" | "danger";
type TextVariant = "eyebrow" | "title" | "section" | "body" | "label" | "caption" | "mono";
type SpaceSize = "xs" | "sm" | "md" | "lg" | "xl";
type GapSize = "xs" | "sm" | "md" | "lg";
type FieldSize = "sm" | "md" | "lg";
type MetricTone = "neutral" | "accent" | "info" | "warning" | "danger";

export function Surface({
  className,
  tone = "default",
  padding = "md",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: SurfaceTone;
  padding?: SurfacePadding;
}) {
  return (
    <div
      className={cx("ds-surface", `ds-surface--${tone}`, `ds-surface--padding-${padding}`, className)}
      {...props}
    />
  );
}

export function Button({
  className,
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  iconRight,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}) {
  return (
    <button
      className={cx("ds-button", `ds-button--${variant}`, `ds-button--${size}`, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span aria-hidden="true" className="ds-button__spinner" /> : icon ? <span className="ds-button__icon">{icon}</span> : null}
      {children}
      {!loading && iconRight ? <span className="ds-button__icon-right">{iconRight}</span> : null}
    </button>
  );
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
}) {
  return <span className={cx("ds-badge", `ds-badge--${tone}`, className)} {...props} />;
}

export function Text({
  as,
  className,
  variant = "body",
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  variant?: TextVariant;
}) {
  const Comp = as ?? "p";
  return <Comp className={cx("ds-text", `ds-text--${variant}`, className)} {...props} />;
}

export function Stack({
  className,
  space = "md",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  space?: SpaceSize;
}) {
  return <div className={cx("ds-stack", `ds-stack--${space}`, className)} {...props} />;
}

export function Cluster({
  className,
  gap = "sm",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  gap?: GapSize;
}) {
  return <div className={cx("ds-cluster", `ds-cluster--${gap}`, className)} {...props} />;
}

export function Divider({ className, ...props }: HTMLAttributes<HTMLHRElement>) {
  return <hr className={cx("ds-divider", className)} {...props} />;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={cx("ds-page-header", className)} {...props}>
      <Stack className="ds-page-header__body" space="sm">
        {eyebrow ? <Text variant="eyebrow">{eyebrow}</Text> : null}
        <Text as="h1" variant="title">
          {title}
        </Text>
        {description ? <Text>{description}</Text> : null}
      </Stack>
      {actions ? <div className="ds-page-header__actions">{actions}</div> : null}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={cx("ds-section-header", className)} {...props}>
      <Stack className="ds-section-header__body" space="xs">
        <Text as="h2" variant="section">
          {title}
        </Text>
        {description ? <Text variant="caption">{description}</Text> : null}
      </Stack>
      {action ? <div className="ds-section-header__action">{action}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  meta,
  icon,
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  tone?: MetricTone;
}) {
  return (
    <Surface className={cx("ds-metric-card", `ds-metric-card--${tone}`, className)} tone="muted" {...props}>
      <div className="ds-metric-card__header">
        <Stack space="xs">
          <Text variant="label">{label}</Text>
          <div className="ds-metric-card__value">{value}</div>
        </Stack>
        {icon ? <div className="ds-metric-card__icon">{icon}</div> : null}
      </div>
      {meta ? <Text variant="caption">{meta}</Text> : null}
    </Surface>
  );
}

export function Field({
  label,
  required,
  hint,
  htmlFor,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className={cx("ds-field", className)} {...props}>
      <label className="ds-field__label" htmlFor={htmlFor}>
        <Text as="span" variant="label">
          {label}
        </Text>
        {required ? <span className="ds-field__required">*</span> : null}
      </label>
      {children}
      {hint ? <Text variant="caption">{hint}</Text> : null}
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { fieldSize?: FieldSize }
>(function Input({ className, fieldSize = "md", ...props }, ref) {
  return <input ref={ref} className={cx("ds-input", `ds-input--${fieldSize}`, className)} {...props} />;
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { fieldSize?: FieldSize }
>(function Select({ className, fieldSize = "md", children, ...props }, ref) {
  return (
    <select ref={ref} className={cx("ds-select", `ds-select--${fieldSize}`, className)} {...props}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cx("ds-textarea", className)} {...props} />;
  },
);

export function FormError({ error }: { error?: string | null }) {
  if (!error) {
    return null;
  }

  return (
    <Surface className="ds-form-error" padding="sm" tone="danger">
      <span aria-hidden="true" className="ds-form-error__icon">
        <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
          <path d="M12 8v5m0 4h.01M10.3 3.9 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      </span>
      <Text variant="caption">{error}</Text>
    </Surface>
  );
}

export function SubmitButton({
  loading,
  label,
  loadingLabel,
  className,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  loading?: boolean;
  label: string;
  loadingLabel?: string;
}) {
  return (
    <Button className={className} loading={loading} type="button" variant="primary" {...props}>
      {loading ? loadingLabel ?? "Saving..." : label}
    </Button>
  );
}

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
  headerClassName?: string;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyState,
  footer,
  header,
  className,
  rowClassName,
}: {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  getRowKey?: (row: T, index: number) => React.Key;
  emptyState?: ReactNode;
  footer?: ReactNode;
  header?: ReactNode;
  className?: string;
  rowClassName?: string | ((row: T, index: number) => string | undefined);
}) {
  return (
    <Surface className={cx("ds-data-table", className)} padding="none">
      {header ? <div className="ds-data-table__header">{header}</div> : null}
      <div className="ds-data-table__scroller">
        {rows.length === 0 ? (
          emptyState ?? (
            <div className="ds-empty-state">
              <Text variant="caption">No data available.</Text>
            </div>
          )
        ) : (
          <table className="ds-data-table__table">
            <thead>
              <tr className="ds-data-table__head-row">
                {columns.map((column) => (
                  <th
                    key={column.id}
                    className={cx(
                      "ds-data-table__head-cell",
                      `ds-data-table__align-${column.align ?? "left"}`,
                      column.headerClassName,
                    )}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="ds-data-table__body">
              {rows.map((row, index) => {
                const computedRowClassName =
                  typeof rowClassName === "function" ? rowClassName(row, index) : rowClassName;

                return (
                  <tr
                    key={getRowKey ? getRowKey(row, index) : index}
                    className={cx("ds-data-table__row", computedRowClassName)}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={cx(
                          "ds-data-table__cell",
                          `ds-data-table__align-${column.align ?? "left"}`,
                          column.className,
                        )}
                        data-label={getColumnHeaderText(column.header, column.id)}
                      >
                        {column.cell(row, index)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {footer ? <div className="ds-data-table__footer">{footer}</div> : null}
    </Surface>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("ds-empty-state", className)}>
      <Stack className="ds-empty-state__content" space="sm">
        {icon ? <div className="ds-empty-state__icon">{icon}</div> : null}
        <Text as="h3" variant="section">
          {title}
        </Text>
        {description ? <Text variant="caption">{description}</Text> : null}
        {action ? <div>{action}</div> : null}
      </Stack>
    </div>
  );
}
