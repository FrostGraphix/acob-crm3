import { Link } from "react-router-dom";
import type { AppPageConfig } from "../../types";

interface TabBarProps {
  tabs: AppPageConfig[];
  activePath: string;
  onClose: (path: string) => void;
}

export function TabBar({ tabs, activePath, onClose }: TabBarProps) {
  return (
    <div className="tab-bar">
      {tabs.map((tab) => {
        const isActive = tab.path === activePath;
        return (
          <div key={tab.path} className={`tab-item ${isActive ? "active" : ""}`}>
            <Link to={tab.path} className="tab-link">
              <span className={`status-dot ${isActive ? "active" : ""}`} />
              {tab.menuLabel}
            </Link>
            {tab.path !== "/dashboard" && (
              <button
                type="button"
                className="tab-close"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onClose(tab.path);
                }}
                title="Close tab"
              >
                x
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
