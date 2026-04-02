import type { DataPageConfig } from "../../types";

interface ReportTabStripProps {
  configs: DataPageConfig[];
  activePath: string;
  onChange: (path: string) => void;
}

export function ReportTabStrip({ configs, activePath, onChange }: ReportTabStripProps) {
  return (
    <div className="reports-tab-strip no-scrollbar">
      {configs.map((config) => (
        <button
          key={config.path}
          className={`button ${activePath === config.path ? "button-primary" : "button-ghost"}`}
          onClick={() => onChange(config.path)}
          type="button"
        >
          {config.menuLabel}
        </button>
      ))}
    </div>
  );
}
