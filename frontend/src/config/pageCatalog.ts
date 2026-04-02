import type { AppPageConfig, NavigationSection, SidebarIconKey } from "../types/index.ts";
import { managementPages } from "./management-pages.ts";
import { remotePages } from "./remote-pages.ts";
import { reportPages } from "./report-pages.ts";
import { tokenPages } from "./token-pages.ts";

const dashboardPage: AppPageConfig = {
  kind: "dashboard",
  path: "/dashboard",
  title: "Dashboard",
  menuLabel: "Dashboard",
  description: "Overview of KPIs, purchase patterns, alarms, and consumption.",
  sectionKey: "dashboard",
};

const pages: AppPageConfig[] = [
  dashboardPage,
  ...tokenPages,
  ...remotePages,
  ...reportPages,
  ...managementPages,
];

const sectionDefinitions: Array<{
  key: string;
  label: string;
  iconKey: SidebarIconKey;
}> = [
  { key: "dashboard", label: "Dashboard", iconKey: "dashboard" },
  { key: "token-generate", label: "Token Generate", iconKey: "token-generate" },
  { key: "token-record", label: "Token Record", iconKey: "token-record" },
  { key: "remote-operation", label: "Remote Operation", iconKey: "remote-operation" },
  { key: "remote-operation-task", label: "Remote Operation Task", iconKey: "remote-operation-task" },
  { key: "data-report", label: "Data Report", iconKey: "data-report" },
  { key: "load-profile", label: "Load Profile", iconKey: "load-profile" },
  { key: "management", label: "Management", iconKey: "management" },
  { key: "meter", label: "Meter", iconKey: "meter" },
  { key: "debt", label: "Debt", iconKey: "debt" },
  { key: "protocol", label: "Protocol", iconKey: "protocol" },
  { key: "event", label: "Events", iconKey: "event" },
  { key: "log", label: "System Log", iconKey: "log" },
];

export const defaultPath = "/dashboard";
export const allPages = pages;
export const pagesByPath = Object.fromEntries(
  pages.map((page) => [page.path, page]),
) as Record<string, AppPageConfig>;

export const navigationSections: NavigationSection[] = sectionDefinitions.map(
  (section): NavigationSection => ({
    key: section.key,
    label: section.label,
    iconKey: section.iconKey,
    items: pages.filter(
      (page) => page.sectionKey === section.key && page.includeInNavigation !== false,
    ),
  }),
);
