import type { AppPageConfig, NavigationSection, SidebarIconKey } from "../types/index.ts";
import { managementPages } from "./management-pages.ts";
import { remotePages } from "./remote-pages.ts";
import { reportPages } from "./report-pages.ts";
import { tokenPages } from "./token-pages.ts";
import { vendorPages } from "./vendor-pages.ts";
import { walletAdminPages } from "./wallet-admin-pages.ts";

const dashboardPage: AppPageConfig = {
  kind: "dashboard",
  path: "/dashboard",
  title: "Dashboard",
  menuLabel: "Dashboard",
  description: "Overview of KPIs, purchase patterns, alarms, and consumption.",
  sectionKey: "dashboard",
};

const designSystemPage: AppPageConfig = {
  kind: "profile",
  path: "/design-system",
  title: "Design System",
  menuLabel: "Design System",
  description: "Visual showcase for the shared Odyssey frontend primitives and tokens.",
  sectionKey: "dashboard",
  includeInNavigation: false,
};

const pages: AppPageConfig[] = [
  dashboardPage,
  designSystemPage,
  ...tokenPages,
  ...remotePages,
  ...reportPages,
  ...managementPages,
  ...vendorPages,
  ...walletAdminPages,
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
  { key: "runtime-ops", label: "Runtime Ops", iconKey: "runtime-ops" },
  { key: "event", label: "Events", iconKey: "event" },
  { key: "log", label: "System Log", iconKey: "log" },
  { key: "wallet-admin-home", label: "Wallet Command", iconKey: "wallet" },
  { key: "wallet-admin-vendors", label: "Vendor Ops", iconKey: "management" },
  { key: "wallet-admin-funding", label: "Wallet Controls", iconKey: "wallet" },
  { key: "wallet-admin-settlement", label: "Settlement", iconKey: "token-record" },
  { key: "vendor-dashboard", label: "Vendor Dashboard", iconKey: "dashboard" },
  { key: "vendor-buy", label: "Buy Units", iconKey: "token-generate" },
  { key: "vendor-history", label: "History", iconKey: "token-record" },
  { key: "vendor-wallet", label: "Wallet", iconKey: "wallet" },
  { key: "vendor-account", label: "Profile", iconKey: "management" },
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
