import { useEffect, useState } from "react";
import type { ActionConfig } from "../../types";

interface FormModalProps {
  action: ActionConfig;
  onCancel: () => void;
  onSubmit: (values: Record<string, string>) => void;
}

function createInitialValues(action: ActionConfig) {
  return (action.fields ?? []).reduce<Record<string, string>>((accumulator, field) => {
    accumulator[field.key] = "";
    return accumulator;
  }, {});
}

export function FormModal({ action, onCancel, onSubmit }: FormModalProps) {
  const [values, setValues] = useState<Record<string, string>>(createInitialValues(action));

  useEffect(() => {
    setValues(createInitialValues(action));
  }, [action]);

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
