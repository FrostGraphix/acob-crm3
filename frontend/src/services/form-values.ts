import type { ActionConfig, DataRow } from "../types";

function toFieldValue(value: DataRow[string] | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

export function createInitialFormValues(action: ActionConfig, row?: DataRow) {
  return (action.fields ?? []).reduce<Record<string, string>>((accumulator, field) => {
    const sourceKey = field.sourceKey ?? field.key;
    accumulator[field.key] = row ? toFieldValue(row[sourceKey]) : "";
    return accumulator;
  }, {});
}
