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

const runtimeAdminPage: AppPageConfig = {
  kind: "runtime-admin",
  path: "/system/runtime",
  title: "Runtime Operations",
  menuLabel: "Runtime Operations",
  description: "Background engine control, runtime health, and data-engine operations.",
  sectionKey: "runtime-ops",
  requiredRole: "admin",
};

const pages: AppPageConfig[] = [
  dashboardPage,
  designSystemPage,
  runtimeAdminPage,
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
  { key: "remote-operation-gprs", label: "Remote Operation GPRS", iconKey: "remote-operation" },
  { key: "remote-operation-task", label: "Remote Operation Record", iconKey: "remote-operation-task" },
  { key: "remote-operation-task-gprs", label: "Remote Operation GPRS Task", iconKey: "remote-operation-task" },
  { key: "prepay-report", label: "Prepay Report", iconKey: "data-report" },
  { key: "remote-report", label: "Remote Report", iconKey: "load-profile" },
  { key: "management", label: "Management", iconKey: "management" },
  { key: "meter", label: "Meter", iconKey: "meter" },
  { key: "event", label: "Events", iconKey: "event" },
  { key: "log", label: "System Log", iconKey: "log" },
  { key: "runtime-ops", label: "Runtime Ops", iconKey: "management" },
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
  pages.flatMap((page) => [page.path, ...(page.aliasPaths ?? [])].map((path) => [path, page] as const)),
) as Record<string, AppPageConfig>;

export const navigationSections: NavigationSection[] = sectionDefinitions.map(
  (section): NavigationSection => ({
    key: section.key,
    label: section.label,
    iconKey: section.iconKey,
    items: pages.filter(
      (page) =>
        page.sectionKey === section.key &&
        page.includeInNavigation !== false,
    ),
  }),
).filter((section) => section.items.length > 0);
