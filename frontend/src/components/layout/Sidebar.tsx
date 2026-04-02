import React, { useState, useEffect, useRef } from "react";
import type { NavigationSection, SidebarIconKey } from "../../types";

interface SidebarProps {
  currentPath: string;
  sections: NavigationSection[];
  onNavigate: (path: string) => void;
  isOpen?: boolean;
  isCollapsed?: boolean;
}



function renderSectionIcon(iconKey: SidebarIconKey) {
  const className = "sidebar-section-icon";

  switch (iconKey) {
    case "dashboard":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M3 3h7v9H3V3zm11 0h7v5h-7V3zm0 9h7v9h-7v-9zM3 16h7v5H3v-5z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "token-generate":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "token-record":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 12h6M9 16h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "remote-operation":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "remote-operation-task":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 14l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "data-report":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "management":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "meter":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "debt":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M2 7h20M5 7v10a2 2 0 002 2h10a2 2 0 002-2V7M9 12h6M12 12v4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "protocol":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M4 6h16M4 10h16M4 14h10M4 18h6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18 14l2 2-2 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "load-profile":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 16l4-6 4 4 5-8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "log":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 2v6h6M8 13h8M8 17h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "event":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "file-upload":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
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
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
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
  const [openSectionKey, setOpenSectionKey] = useState<string>("");
  const [hoverTimeout, setHoverTimeout] = useState<number | null>(null);
  const [flyoutOffset, setFlyoutOffset] = useState<React.CSSProperties>({});
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close flyout
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setOpenSectionKey("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>, sectionKey: string) => {
    if (!isCollapsed) return;
    if (hoverTimeout) window.clearTimeout(hoverTimeout);
    
    const rect = e.currentTarget.getBoundingClientRect();
    const isBottomHalf = rect.top > window.innerHeight / 2;
    
    if (isBottomHalf) {
      setFlyoutOffset({ bottom: `${window.innerHeight - rect.bottom}px`, top: 'auto' });
    } else {
      setFlyoutOffset({ top: `${rect.top}px`, bottom: 'auto' });
    }
    
    setOpenSectionKey(sectionKey);
  };

  const handleMouseLeave = () => {
    if (!isCollapsed) return;
    const timeout = window.setTimeout(() => {
      setOpenSectionKey("");
    }, 3000);
    setHoverTimeout(timeout as unknown as number);
  };

  const toggleSection = (sectionKey: string) => {
    if (isCollapsed) return;
    setOpenSectionKey((current) => (current === sectionKey ? "" : sectionKey));
  };

  return (
    <aside 
      className={`sidebar ${isOpen ? "open" : ""} ${isCollapsed ? "collapsed" : ""}`}
      ref={sidebarRef}
    >
      <div className="sidebar-scroll-shell">
        <div className="sidebar-brand-area">
          <div className="sidebar-brand">
            <div className="sidebar-logo-mark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="sidebar-brand-text">
              <span className="brand-title">ACOB <strong>CRM3</strong></span>
            </div>
          </div>
          
          <div className="sidebar-site-dropdown">
            <button className="site-drop-btn" title="Switch Site" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </button>
          </div>
        </div>

        <div className="sidebar-intro">
          <span className="sidebar-intro-label">Navigation</span>
          <span className="sidebar-intro-rule" />
        </div>

        <nav className="sidebar-nav">
          {sections.map((section) => {
            const singleItem = section.items.length === 1 ? section.items[0] : null;
            const isExpanded = !singleItem && openSectionKey === section.key;
            const isDirectActive = singleItem?.path === currentPath;

            return (
              <div
                className={`sidebar-section ${isExpanded || isDirectActive ? "expanded" : ""}`}
                key={section.key}
              >
                <button
                  aria-current={isDirectActive ? "page" : undefined}
                  aria-expanded={singleItem ? undefined : isExpanded}
                  className={`sidebar-section-toggle ${isExpanded || isDirectActive ? "expanded" : ""}`}
                  onClick={() => {
                    if (singleItem) {
                      setOpenSectionKey("");
                      onNavigate(singleItem.path);
                      return;
                    }
                    toggleSection(section.key);
                  }}
                  onMouseEnter={singleItem ? undefined : (e) => handleMouseEnter(e, section.key)}
                  onMouseLeave={singleItem ? undefined : handleMouseLeave}
                  title={isCollapsed ? (singleItem?.menuLabel ?? section.label) : undefined}
                  type="button"
                >
                  <span className="sidebar-section-main">
                    <span className="sidebar-section-icon-wrap">
                      {renderSectionIcon(section.iconKey)}
                    </span>
                    <span className="sidebar-section-label">{singleItem?.menuLabel ?? section.label}</span>
                  </span>
                  {!singleItem ? (
                    <span className="sidebar-section-meta">
                      {renderChevron(isExpanded)}
                    </span>
                  ) : null}
                </button>

                {!singleItem && isExpanded ? (
                  <div
                    className={`sidebar-section-body ${isCollapsed ? "sidebar-section-body-flyout" : ""}`}
                    onMouseEnter={() => isCollapsed && hoverTimeout && window.clearTimeout(hoverTimeout)}
                    onMouseLeave={handleMouseLeave}
                    style={isCollapsed ? flyoutOffset : undefined}
                  >
                    {isCollapsed ? (
                      <div className="sidebar-flyout-card">
                        <div className="sidebar-flyout-header">
                          <strong className="sidebar-flyout-title">{section.label}</strong>
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
                              <span className="sidebar-link-glow" />
                              <span className="sidebar-link-label">{item.menuLabel}</span>
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
                            <span className="sidebar-link-glow" />
                            <span className="sidebar-link-label">{item.menuLabel}</span>
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
