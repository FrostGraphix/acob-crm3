import type { FilterField } from "../../types";

interface SearchBarProps {
  fields: FilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSearch: () => void;
  onReset: () => void;
}

export function SearchBar({
  fields,
  values,
  onChange,
  onSearch,
  onReset,
}: SearchBarProps) {
  return (
    <div className="toolbar-panel">
      <div className="toolbar-grid">
        {fields.map((field) => (
          <label className="field" key={field.key}>
            <span>{field.label}</span>
            <input
              onChange={(event) => onChange(field.key, event.target.value)}
              placeholder={field.placeholder}
              type={field.type ?? "text"}
              value={values[field.key] ?? ""}
            />
          </label>
        ))}
      </div>
      <div className="toolbar-actions">
        <button className="button button-primary" onClick={onSearch} type="button">
          Search
        </button>
        <button className="button button-ghost" onClick={onReset} type="button">
          Reset
        </button>
      </div>
    </div>
  );
}
