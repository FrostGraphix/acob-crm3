import test from "node:test";
import assert from "node:assert/strict";
import { createInitialFormValues } from "../../frontend/src/services/form-values.ts";
import type { ActionConfig } from "../../frontend/src/types/index.ts";

test("form modal pre-fills management edit fields from row data", () => {
  const action: ActionConfig = {
    key: "edit",
    label: "Edit Customer",
    endpoint: "/api/customer/update",
    operationKind: "management-update",
    fields: [
      { key: "id", label: "Customer Id", placeholder: "Customer id" },
      { key: "name", label: "Name", placeholder: "Customer name" },
      { key: "phone", label: "Phone", placeholder: "Phone number" },
    ],
  };

  const values = createInitialFormValues(action, {
    id: "C-001",
    name: "Jane Doe",
    phone: "08000000000",
  });

  assert.deepEqual(values, {
    id: "C-001",
    name: "Jane Doe",
    phone: "08000000000",
  });
});
