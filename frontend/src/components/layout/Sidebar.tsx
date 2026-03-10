import { useState } from "react";
import type { NavigationSection } from "../../types";

interface SidebarProps {
  currentPath: string;
  sections: NavigationSection[];
  onNavigate: (path: string) => void;
}

export function Sidebar({ currentPath, sections, onNavigate }: SidebarProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    sections.reduce<Record<string, boolean>>((accumulator, section) => {
      accumulator[section.key] = true;
      return accumulator;
    }, {}),
  );

  const toggleSection = (sectionKey: string) => {
    setOpenSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark">A</span>
        <div>
          <strong>ACOB CRM3</strong>
          <p>Meter system control</p>
        </div>
      </div>
      <nav className="sidebar-nav">
        {sections.map((section) => (
          <div className="sidebar-section" key={section.key}>
            <button
              className="sidebar-section-toggle"
              onClick={() => toggleSection(section.key)}
              type="button"
            >
              <span>{section.label}</span>
              <span>{openSections[section.key] ? "-" : "+"}</span>
            </button>
            {openSections[section.key] ? (
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
                    type="button"
                  >
                    {item.menuLabel}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </nav>
    </aside>
  );
}
