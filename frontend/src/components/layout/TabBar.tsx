import { Link } from "react-router-dom";
import { Button } from "../../design-system";
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
              <span className="tab-label">{tab.menuLabel}</span>
            </Link>
            {tab.path !== "/dashboard" && (
              <Button
                aria-label={`Close ${tab.menuLabel}`}
                className="tab-close"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onClose(tab.path);
                }}
                size="icon"
                tone="ghost"
                title="Close tab"
              >
                <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                  <path d="M6 6l12 12M18 6l-12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
