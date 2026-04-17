import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "admin-identity-override-test-secret";
process.env.ADMIN_USERNAMES = "admin";
process.env.ADMIN_EMAILS = "admin@example.com";

const { applyAdminIdentityOverrides } = await import(
  "../../backend/dist/backend/src/services/admin-identities.js"
);

test("configured admin usernames are elevated to Administrator", () => {
  const elevated = applyAdminIdentityOverrides({
    username: "admin",
    displayName: "Admin User",
    role: "User",
  });

  assert.equal(elevated.role, "Administrator");
});

test("configured admin emails are elevated to Administrator", () => {
  const elevated = applyAdminIdentityOverrides({
    username: "operator",
    displayName: "Admin Email User",
    role: "Viewer",
    email: "admin@example.com",
  });

  assert.equal(elevated.role, "Administrator");
});

test("non-admin identities keep their existing role", () => {
  const user = {
    username: "operator",
    displayName: "Operator User",
    role: "Operator",
    email: "operator@example.com",
  };
  const elevated = applyAdminIdentityOverrides(user);

  assert.equal(elevated.role, "Operator");
  assert.deepEqual(elevated, user);
});
