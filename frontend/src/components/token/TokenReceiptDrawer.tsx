import { Button, Surface } from "../../design-system";

interface TokenReceiptDrawerAction {
  label: string;
  onClick: () => void;
  tone?: "primary" | "neutral" | "ghost" | "danger";
}

interface TokenReceiptDrawerField {
  label: string;
  value: string;
}

interface TokenReceiptDrawerProps {
  open: boolean;
  eyebrow: string;
  title: string;
  subtitle: string;
  tokenValue: string;
  heroFields: TokenReceiptDrawerField[];
  detailFields: TokenReceiptDrawerField[];
  primaryAction: TokenReceiptDrawerAction;
  secondaryActions?: TokenReceiptDrawerAction[];
  onClose: () => void;
}

export function TokenReceiptDrawer({
  open,
  eyebrow,
  title,
  subtitle,
  tokenValue,
  heroFields,
  detailFields,
  primaryAction,
  secondaryActions = [],
  onClose,
}: TokenReceiptDrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="token-receipt-drawer-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <Surface as="aside" className="token-receipt-drawer token-neutral-surface" tone="default">
        <div className="token-receipt-drawer__header">
          <div>
            <p className="token-receipt-drawer__eyebrow">{eyebrow}</p>
            <h2 className="token-receipt-drawer__title">{title}</h2>
            <p className="token-receipt-drawer__subtitle">{subtitle}</p>
          </div>
          <Button aria-label="Close" className="modal-close" onClick={onClose} size="icon" tone="ghost">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        </div>

        <div className="token-receipt-drawer__body">
          <div className="token-receipt-paper">
            <div className="token-receipt-paper__header">
              <p>{eyebrow}</p>
              <strong>{title}</strong>
              <span>{subtitle}</span>
            </div>

            <div className="token-receipt-paper__token">{tokenValue}</div>

            <div className="token-receipt-paper__hero">
              {heroFields.map((field) => (
                <div key={field.label}>
                  <span>{field.label}</span>
                  <strong>{field.value}</strong>
                </div>
              ))}
            </div>

            <div className="token-receipt-paper__details">
              {detailFields.map((field) => (
                <div key={field.label}>
                  <span>{field.label}</span>
                  <strong>{field.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="token-receipt-drawer__actions">
          <Button onClick={primaryAction.onClick} tone={primaryAction.tone ?? "neutral"}>
            {primaryAction.label}
          </Button>
          {secondaryActions.map((action) => (
            <Button key={action.label} onClick={action.onClick} tone={action.tone ?? "ghost"}>
              {action.label}
            </Button>
          ))}
        </div>
      </Surface>
    </div>
  );
}

export default TokenReceiptDrawer;
