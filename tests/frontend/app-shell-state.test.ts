import assert from "node:assert/strict";
import test from "node:test";
import {
  closeTabAndResolveNextPath,
  filterNavigationSectionsForUser,
  resolveAccessiblePage,
  syncOpenedTabsWithUserAccess,
  userCanAccessPage,
} from "../../frontend/src/services/app-shell-state.ts";
import { allPages, navigationSections, pagesByPath } from "../../frontend/src/config/pageCatalog.ts";

const adminUser = {
  username: "admin",
  displayName: "Admin",
  role: "Administrator",
};

const adminUserWithEventPermission = {
  ...adminUser,
  permissions: ["EventNotification.EventNotification"],
};

const operatorUser = {
  username: "operator",
  displayName: "Operator",
  role: "Operator",
};

test("admin-only runtime page is hidden from non-admin users", () => {
  const runtimePage = allPages.find((page) => page.path === "/system/runtime");
  assert.ok(runtimePage);
  assert.equal(userCanAccessPage(operatorUser, runtimePage), false);
  assert.equal(userCanAccessPage(adminUser, runtimePage), true);
});

test("navigation sections exclude unauthorized pages", () => {
  const operatorSections = filterNavigationSectionsForUser(navigationSections, operatorUser);
  const operatorPaths = new Set(operatorSections.flatMap((section) => section.items.map((item) => item.path)));

  assert.equal(operatorPaths.has("/system/runtime"), false);
  assert.equal(operatorPaths.has("/dashboard"), true);
});

test("permission-gated pages stay hidden without upstream permission claims", () => {
  const eventPage = allPages.find((page) => page.path === "/event-notification");
  assert.ok(eventPage);
  assert.equal(userCanAccessPage(adminUser, eventPage), false);
  assert.equal(userCanAccessPage(adminUserWithEventPermission, eventPage), true);
});

test("routing falls back to an accessible page when the current page is unauthorized", () => {
  const fallbackPage = pagesByPath["/dashboard"];
  const resolved = resolveAccessiblePage("/system/runtime", pagesByPath, fallbackPage, operatorUser);

  assert.equal(resolved.path, "/dashboard");
});

test("opened tabs are pruned when user access changes", () => {
  const fallbackPage = pagesByPath["/dashboard"];
  const nextTabs = syncOpenedTabsWithUserAccess(
    [pagesByPath["/dashboard"], pagesByPath["/system/runtime"]],
    allPages.filter((page) => userCanAccessPage(operatorUser, page)),
    fallbackPage,
  );

  assert.deepEqual(nextTabs.map((tab) => tab.path), ["/dashboard"]);
});

test("closing the active tab routes to the previous visible tab", () => {
  const result = closeTabAndResolveNextPath(
    [pagesByPath["/dashboard"], pagesByPath["/management/customer"], pagesByPath["/site-consumption"]],
    "/site-consumption",
    "/site-consumption",
    "/dashboard",
  );

  assert.equal(result.nextPath, "/management/customer");
  assert.deepEqual(
    result.nextTabs.map((tab) => tab.path),
    ["/dashboard", "/management/customer"],
  );
});
