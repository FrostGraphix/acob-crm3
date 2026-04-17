import type { AuthUser } from "../types";
import type { AppPageConfig, NavigationSection } from "../types";

function normalizeRole(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizePermission(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function isVendorWorkspaceUser(user: AuthUser | null) {
  if (!user) {
    return false;
  }

  const roleValues = [user.appRole, user.role]
    .map((value) => normalizeRole(value))
    .filter((value) => value.length > 0);

  return roleValues.some((value) => value.includes("vendor"));
}

export function pagePathMatchesPathname(pagePath: string, pathname: string) {
  const normalizedPagePath = pagePath.replace(/\/+$/, "") || "/";
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";

  if (normalizedPagePath === normalizedPathname) {
    return true;
  }

  const pageSegments = normalizedPagePath.split("/").filter(Boolean);
  const pathSegments = normalizedPathname.split("/").filter(Boolean);

  if (pageSegments.length !== pathSegments.length) {
    return false;
  }

  return pageSegments.every((segment, index) => segment.startsWith(":") || segment === pathSegments[index]);
}

function userHasRequiredPermissions(user: AuthUser | null, requiredPermissions?: string[]) {
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  if (!user) {
    return false;
  }

  const userPermissions = new Set(
    (user.permissions ?? [])
      .map((permission) => normalizePermission(permission))
      .filter((permission) => permission.length > 0),
  );

  if (userPermissions.size === 0) {
    return false;
  }

  return requiredPermissions.some((permission) =>
    userPermissions.has(normalizePermission(permission)),
  );
}

export function userCanAccessPage(user: AuthUser | null, page: AppPageConfig) {
  const pageWorkspace = page.workspace ?? "operations";
  const vendorUser = isVendorWorkspaceUser(user);

  if (user && vendorUser && pageWorkspace !== "vendor") {
    return false;
  }

  if (user && !vendorUser && pageWorkspace === "vendor") {
    return false;
  }

  if (page.requiredRole) {
    if (!user) {
      return false;
    }

    const requiredRoles = page.requiredRole
      .split(",")
      .map((value) => normalizeRole(value))
      .filter((value) => value.length > 0);
    const roleValues = [user.role, user.appRole]
      .map((value) => normalizeRole(value))
      .filter((value) => value.length > 0);

    if (
      requiredRoles.length > 0 &&
      !requiredRoles.some((requiredRole) =>
        roleValues.some((value) => value.includes(requiredRole)),
      )
    ) {
      return false;
    }
  }

  return userHasRequiredPermissions(user, page.requiredPermissions);
}

export function filterPagesForUser(pages: AppPageConfig[], user: AuthUser | null) {
  return pages.filter((page) => userCanAccessPage(user, page));
}

export function filterNavigationSectionsForUser(
  sections: NavigationSection[],
  user: AuthUser | null,
): NavigationSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((page) => userCanAccessPage(user, page)),
    }))
    .filter((section) => section.items.length > 0);
}

export function resolveAccessiblePage(
  pathname: string,
  pagesByPath: Record<string, AppPageConfig>,
  fallbackPage: AppPageConfig,
  user: AuthUser | null,
  allPages: AppPageConfig[] = Object.values(pagesByPath),
) {
  const currentPage =
    pagesByPath[pathname] ??
    allPages.find((page) => pagePathMatchesPathname(page.path, pathname));
  if (currentPage && userCanAccessPage(user, currentPage)) {
    return currentPage;
  }

  return fallbackPage;
}

export function ensureCurrentTabVisible(tabs: AppPageConfig[], currentPage: AppPageConfig) {
  if (tabs.some((tab) => tab.path === currentPage.path)) {
    return tabs;
  }

  return [...tabs, currentPage];
}

export function syncOpenedTabsWithUserAccess(
  tabs: AppPageConfig[],
  allowedPages: AppPageConfig[],
  fallbackPage: AppPageConfig,
) {
  const allowedPaths = new Set(allowedPages.map((page) => page.path));
  const nextTabs = tabs.filter((tab) => allowedPaths.has(tab.path));
  return nextTabs.length > 0 ? nextTabs : [fallbackPage];
}

export function closeTabAndResolveNextPath(
  tabs: AppPageConfig[],
  closingPath: string,
  activePath: string,
  fallbackPath: string,
) {
  const filteredTabs = tabs.filter((tab) => tab.path !== closingPath);
  const nextTabs = filteredTabs.length > 0 ? filteredTabs : tabs.filter((tab) => tab.path === fallbackPath);
  const nextPath =
    closingPath === activePath
      ? (filteredTabs[filteredTabs.length - 1]?.path ?? fallbackPath)
      : activePath;

  return {
    nextTabs,
    nextPath,
  };
}
