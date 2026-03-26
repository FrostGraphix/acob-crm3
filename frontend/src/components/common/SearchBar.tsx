import type { FilterField } from "../../types";

interface SearchBarProps {
  fields: FilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSearch: () => void;
  onReset: () => void;
}

const SearchIcon = () => (
  <svg className="search-field-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
  </svg>
);

const CalendarIcon = () => (
  <svg className="search-field-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
  </svg>
);

const HashIcon = () => (
  <svg className="search-field-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
  </svg>
);

export function SearchBar({
  fields,
  values,
  onChange,
  onSearch,
  onReset,
}: SearchBarProps) {
  const getIcon = (type?: string) => {
    if (type === "date") return <CalendarIcon />;
    if (type === "number") return <HashIcon />;
    return <SearchIcon />;
  };

  return (
    <div className="search-filter-bar">
      {fields.map((field) => (
        <div className="search-field-group" key={field.key}>
          {getIcon(field.type)}
          <input
            onChange={(event) => onChange(field.key, event.target.value)}
            placeholder={field.placeholder || field.label}
            type={field.type ?? "text"}
            value={values[field.key] ?? ""}
          />
        </div>
      ))}
      <div className="action-pill-group">
        <button className="button button-primary search-pill-button" onClick={onSearch} type="button">
          Search
        </button>
        <button className="button button-ghost search-pill-button" onClick={onReset} type="button">
          Reset
        </button>
      </div>
    </div>
  );
}
