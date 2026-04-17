import { useEffect, useState } from "react";
import { Button, Field, Surface } from "../../design-system";
import type { ActionConfig, DataRow } from "../../types";
import { createInitialFormValues } from "../../services/form-values";

interface FormModalProps {
  action: ActionConfig;
  row?: DataRow;
  onCancel: () => void;
  onSubmit: (values: Record<string, string>) => void;
}

export function FormModal({ action, row, onCancel, onSubmit }: FormModalProps) {
  const [values, setValues] = useState<Record<string, string>>(createInitialFormValues(action, row));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValues(createInitialFormValues(action, row));
  }, [action, row]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onCancel]);

  const handleSubmit = () => {
    setSubmitting(true);
    onSubmit(values);
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <Surface as="div" className="modal-card ds-modal-card" tone="raised">
        <div className="modal-header">
          <div className="modal-header-info">
            <span className="modal-eyebrow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Action
            </span>
            <h3 className="modal-title">{action.label}</h3>
          </div>
          <Button aria-label="Close" className="modal-close" onClick={onCancel} size="icon" tone="ghost">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Button>
        </div>

        <div className="modal-body">
          <div className="modal-grid">
            {(action.fields ?? []).map((field) => (
              <Field
                className="modal-field"
                full={field.type === "textarea"}
                helpText={field.helpText}
                key={field.key}
                label={field.label}
                required={field.required}
              >
                {field.type === "textarea" ? (
                  <textarea
                    className="modal-input modal-textarea ds-textarea"
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    placeholder={field.placeholder}
                    rows={6}
                    value={values[field.key] ?? ""}
                  />
                ) : field.type === "select" ? (
                  <select
                    className="modal-input ds-select"
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    value={values[field.key] ?? ""}
                  >
                    <option value="">{field.placeholder}</option>
                    {(field.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="modal-input ds-input"
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    placeholder={field.placeholder}
                    type={field.type ?? "text"}
                    autoComplete={field.type === "password" ? "current-password" : undefined}
                    value={values[field.key] ?? ""}
                  />
                )}
              </Field>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <Button className="modal-btn modal-btn--ghost" onClick={onCancel} tone="ghost">
            Cancel
          </Button>
          <Button
            className="modal-btn modal-btn--primary"
            disabled={submitting}
            onClick={handleSubmit}
            tone="primary"
          >
            {submitting ? "Processing..." : "Confirm"}
            {!submitting && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </Button>
        </div>
      </Surface>
    </div>
  );
}
