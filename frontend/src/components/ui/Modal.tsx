import { useEffect, type ReactNode } from "react";
import {
  Button,
  Field,
  FormError,
  Input,
  Select,
  SubmitButton,
  Surface,
  Text,
  Textarea,
} from "./system";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="ds-modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <Surface
        className={`ds-modal-card ds-modal-card--${size}`}
        onClick={(event) => event.stopPropagation()}
        padding="none"
      >
        <div className="ds-modal-header">
          <div>
            <Text as="h2" variant="section">
              {title}
            </Text>
            {subtitle ? (
              <Text className="ds-modal-subtitle" variant="caption">
                {subtitle}
              </Text>
            ) : null}
          </div>
          <Button
            aria-label="Close dialog"
            className="ds-modal-close"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </Button>
        </div>
        <div className="ds-modal-body">{children}</div>
      </Surface>
    </div>
  );
}

export { Field, FormError, Input, Select, SubmitButton, Textarea };
