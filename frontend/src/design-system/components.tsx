import type {
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
  ElementType,
  ReactNode,
} from "react";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type ButtonTone = "primary" | "secondary" | "ghost" | "neutral" | "danger";
type ButtonSize = "sm" | "md" | "icon";
type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";
type SurfaceTone = "default" | "raised" | "muted" | "hero";
type MetricCardTone = "neutral" | "success" | "warning" | "danger" | "info";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  size?: ButtonSize;
  pill?: boolean;
  active?: boolean;
  fullWidth?: boolean;
}

export function Button({
  className,
  tone = "ghost",
  size = "md",
  pill = false,
  active = false,
  fullWidth = false,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(
        "ds-button",
        `ds-button--${tone}`,
        size !== "md" && `ds-button--${size}`,
        pill && "ds-button--pill",
        active && "ds-button--active",
        fullWidth && "ds-button--full",
        className,
      )}
      type={type}
      {...props}
    />
  );
}

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: BadgeTone;
}) {
  return <span className={cx("ds-badge", `ds-badge--${tone}`, className)}>{children}</span>;
}

export function Field({
  children,
  className,
  helpText,
  label,
  required = false,
  full = false,
}: {
  children: ReactNode;
  className?: string;
  helpText?: ReactNode;
  label: ReactNode;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <label className={cx("ds-field", full && "ds-field--full", className)}>
      <span className="ds-field__label">
        {label}
        {required ? <span className="ds-field__required"> *</span> : null}
      </span>
      {children}
      {helpText ? <span className="ds-field__help">{helpText}</span> : null}
    </label>
  );
}

export function PageHeader({
  actions,
  className,
  description,
  eyebrow,
  meta,
  title,
}: {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header className={cx("ds-page-header", className)}>
      <div className="ds-page-header__copy">
        {eyebrow ? <p className="ds-page-header__eyebrow">{eyebrow}</p> : null}
        <h1 className="ds-page-header__title">{title}</h1>
        {description ? <p className="ds-page-header__description">{description}</p> : null}
        {meta ? <div className="ds-page-header__meta">{meta}</div> : null}
      </div>
      {actions ? <div className="ds-page-header__actions">{actions}</div> : null}
    </header>
  );
}

type SurfaceProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
  tone?: SurfaceTone;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function Surface<T extends ElementType = "section">({
  as,
  children,
  className,
  tone = "default",
  ...props
}: SurfaceProps<T>) {
  const Component = as ?? "section";

  return (
    <Component className={cx("ds-surface", `ds-surface--${tone}`, className)} {...props}>
      {children}
    </Component>
  );
}

export function SurfaceHeader({
  description,
  eyebrow,
  title,
  action,
}: {
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="ds-surface__header">
      <div className="ds-surface__header-copy">
        {eyebrow ? <p className="ds-surface__eyebrow">{eyebrow}</p> : null}
        <h2 className="ds-surface__title">{title}</h2>
        {description ? <p className="ds-surface__description">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function MetricCard({
  className,
  icon,
  label,
  meta,
  tone = "neutral",
  value,
}: {
  className?: string;
  icon?: ReactNode;
  label: ReactNode;
  meta?: ReactNode;
  tone?: MetricCardTone;
  value: ReactNode;
}) {
  return (
    <Surface className={cx("ds-metric-card", `ds-metric-card--${tone}`, className)} tone="muted">
      <div className="ds-metric-card__header">
        <div className="ds-metric-card__copy">
          <span className="ds-metric-card__label">{label}</span>
          <strong className="ds-metric-card__value">{value}</strong>
        </div>
        {icon ? <span className="ds-metric-card__icon">{icon}</span> : null}
      </div>
      {meta ? <span className="ds-metric-card__meta">{meta}</span> : null}
    </Surface>
  );
}
