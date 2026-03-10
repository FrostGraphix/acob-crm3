import test from "node:test";
import assert from "node:assert/strict";
import { allPages, navigationSections } from "../../frontend/src/config/pageCatalog.ts";

test("navigation contains all seven top-level sections", () => {
  assert.equal(navigationSections.length, 7);
});

test("all pages are assigned to a navigation section", () => {
  const pagePaths = new Set(allPages.map((page) => page.path));
  const sectionPaths = new Set(
    navigationSections.flatMap((section) => section.items.map((item) => item.path)),
  );

  assert.deepEqual(sectionPaths, pagePaths);
});

test("critical pages exist in catalog", () => {
  const paths = new Set(allPages.map((page) => page.path));

  assert.equal(paths.has("/dashboard"), true);
  assert.equal(paths.has("/token-generate/credit-token"), true);
  assert.equal(paths.has("/management/customer"), true);
});
