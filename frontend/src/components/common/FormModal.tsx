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

  useEffect(() => {
    setValues(createInitialFormValues(action, row));
  }, [action, row]);

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Action</p>
            <h3>{action.label}</h3>
          </div>
          <button className="button button-ghost" onClick={onCancel} type="button">
            Close
          </button>
        </div>
        <div className="modal-grid">
          {(action.fields ?? []).map((field) => (
            <label className="field" key={field.key}>
              <span>{field.label}</span>
              {field.type === "textarea" ? (
                <textarea
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                  placeholder={field.placeholder}
                  rows={8}
                  value={values[field.key] ?? ""}
                />
              ) : (
                <input
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
        <div className="modal-actions">
          <button className="button button-primary" onClick={() => onSubmit(values)} type="button">
            Confirm
          </button>
          <button className="button button-ghost" onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
