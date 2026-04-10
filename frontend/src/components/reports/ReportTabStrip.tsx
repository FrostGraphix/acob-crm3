import type { DataPageConfig } from "../../types";
import { Button } from "../../design-system";

interface ReportTabStripProps {
  configs: DataPageConfig[];
  activePath: string;
  onChange: (path: string) => void;
}

export function ReportTabStrip({ configs, activePath, onChange }: ReportTabStripProps) {
  return (
    <div className="reports-tab-strip no-scrollbar">
      {configs.map((config) => (
        <Button
          active={activePath === config.path}
          key={config.path}
          className="button"
          onClick={() => onChange(config.path)}
          pill
          tone={activePath === config.path ? "primary" : "ghost"}
          title={config.description}
        >
          {config.menuLabel}
        </Button>
      ))}
    </div>
  );
}
