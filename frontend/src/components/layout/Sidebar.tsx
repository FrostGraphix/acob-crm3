import { useState } from "react";
import type { NavigationSection, SidebarIconKey } from "../../types";

interface SidebarProps {
  currentPath: string;
  sections: NavigationSection[];
  onNavigate: (path: string) => void;
  isOpen?: boolean;
  isCollapsed?: boolean;
}

function getCompactLabel(label: string) {
  const words = label
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }

  return label.slice(0, 2).toUpperCase();
}

function renderSectionIcon(iconKey: SidebarIconKey) {
  const className = "sidebar-section-icon";

  switch (iconKey) {
    case "dashboard":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path d="M4 13h6V4H4zm10 7h6V4h-6zM4 20h6v-5H4zm10 0h6v-9h-6z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "token-generate":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path d="M12 3v18M7 8h7.5a3.5 3.5 0 010 7H9.5a3.5 3.5 0 000 7H17" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "token-record":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path d="M7 4h8l4 4v12H7z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 4v4h4M10 12h5M10 16h5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "remote-operation":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "remote-operation-task":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path d="M9 6h10M9 12h10M9 18h10M5 6h.01M5 12h.01M5 18h.01" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "data-report":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path d="M5 19V9m7 10V5m7 14v-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "management":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path d="M12 8a3 3 0 100-6 3 3 0 000 6zm0 0a8 8 0 00-8 8v2h16v-2a8 8 0 00-8-8z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

function renderChevron(expanded: boolean) {
  return (
    <svg
      className={`sidebar-chevron ${expanded ? "expanded" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Sidebar({
  currentPath,
  sections,
  onNavigate,
  isOpen,
  isCollapsed = false,
}: SidebarProps) {
  const [openSectionKey, setOpenSectionKey] = useState<string>(() => {
    const activeSection = sections.find((section) =>
      section.items.some((item) => item.path === currentPath),
    );

    return activeSection?.key ?? sections[0]?.key ?? "";
  });

  const toggleSection = (sectionKey: string) => {
    setOpenSectionKey((current) => (current === sectionKey ? "" : sectionKey));
  };

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""} ${isCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-scroll-shell">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark">A</span>
          <div className="sidebar-brand-copy">
            <strong>ACOB CRM3</strong>
            <p>Meter system control</p>
          </div>
        </div>

        <div className="sidebar-intro">
          <span className="sidebar-intro-label">Navigation</span>
          <span className="sidebar-intro-rule" />
        </div>

        <nav className="sidebar-nav">
          {sections.map((section) => {
            const isExpanded = openSectionKey === section.key;

            return (
              <div className={`sidebar-section ${isExpanded ? "expanded" : ""}`} key={section.key}>
                <button
                  aria-expanded={isExpanded}
                  className={`sidebar-section-toggle ${isExpanded ? "expanded" : ""}`}
                  onClick={() => toggleSection(section.key)}
                  title={isCollapsed ? section.label : undefined}
                  type="button"
                >
                  <span className="sidebar-section-main">
                    <span className="sidebar-section-icon-wrap">
                      {renderSectionIcon(section.iconKey)}
                    </span>
                    <span className="sidebar-section-label">{section.label}</span>
                  </span>
                  <span className="sidebar-section-meta">
                    <span className="sidebar-section-count">{section.items.length}</span>
                    {renderChevron(isExpanded)}
                  </span>
                </button>

                {isExpanded ? (
                  <div
                    className={`sidebar-section-body ${isCollapsed ? "sidebar-section-body-flyout" : ""}`}
                  >
                    {isCollapsed ? (
                      <div className="sidebar-flyout-card">
                        <div className="sidebar-flyout-header">
                          <strong className="sidebar-flyout-title">{section.label}</strong>
                          <span className="sidebar-section-count">{section.items.length}</span>
                        </div>
                        <div className="sidebar-links">
                          {section.items.map((item) => (
                            <button
                              className={
                                item.path === currentPath
                                  ? "sidebar-link sidebar-link-active"
                                  : "sidebar-link"
                              }
                              key={item.path}
                              onClick={() => onNavigate(item.path)}
                              title={item.menuLabel}
                              type="button"
                            >
                              <span className="sidebar-link-label">{item.menuLabel}</span>
                              <span className="sidebar-link-glow" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="sidebar-links">
                        {section.items.map((item) => (
                          <button
                            className={
                              item.path === currentPath
                                ? "sidebar-link sidebar-link-active"
                                : "sidebar-link"
                            }
                            key={item.path}
                            onClick={() => onNavigate(item.path)}
                            title={isCollapsed ? item.menuLabel : undefined}
                            type="button"
                          >
                            <span className="sidebar-link-compact">
                              {getCompactLabel(item.menuLabel)}
                            </span>
                            <span className="sidebar-link-label">{item.menuLabel}</span>
                            <span className="sidebar-link-glow" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
