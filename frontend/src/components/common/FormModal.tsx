import { useEffect, useState } from "react";
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
      <div className="modal-card">
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
          <button className="modal-close" onClick={onCancel} type="button" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-grid">
            {(action.fields ?? []).map((field) => (
              <label className="modal-field" key={field.key} data-span={field.type === "textarea" ? "full" : undefined}>
                <span className="modal-field-label">{field.label}</span>
                {field.type === "textarea" ? (
                  <textarea
                    className="modal-input modal-textarea"
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
                ) : (
                  <input
                    className="modal-input"
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    placeholder={field.placeholder}
                    type={field.type ?? "text"}
                    value={values[field.key] ?? ""}
                  />
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-btn modal-btn--ghost" onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="modal-btn modal-btn--primary"
            disabled={submitting}
            onClick={handleSubmit}
            type="button"
          >
            {submitting ? "Processing..." : "Confirm"}
            {!submitting && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
