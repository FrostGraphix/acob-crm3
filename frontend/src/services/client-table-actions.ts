import type { DataRow, TableColumn } from "../types";

function readCellValue(value: DataRow[string]) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function escapeCsvCell(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function sanitizeFileNameSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildCsvContent(columns: TableColumn[], rows: DataRow[]) {
  const headerRow = columns.map((column) => escapeCsvCell(column.label)).join(",");
  const dataRows = rows.map((row) =>
    columns
      .map((column) => escapeCsvCell(readCellValue(row[column.key])))
      .join(","),
  );

  return [headerRow, ...dataRows].join("\r\n");
}

export function downloadRowsAsCsv(
  title: string,
  columns: TableColumn[],
  rows: DataRow[],
) {
  const csvContent = buildCsvContent(columns, rows);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `${sanitizeFileNameSegment(title) || "export"}-${dateStamp}.csv`;

  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function printRowDetails(
  title: string,
  columns: TableColumn[],
  row: DataRow,
) {
  const printableWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!printableWindow) {
    throw new Error("Unable to open the print preview window");
  }

  const rowsHtml = columns
    .map((column) => {
      const value = escapeHtml(readCellValue(row[column.key]));
      return `<tr><th>${escapeHtml(column.label)}</th><td>${value || "--"}</td></tr>`;
    })
    .join("");

  printableWindow.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
      h1 { margin-bottom: 16px; font-size: 20px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; }
      th { width: 35%; background: #f3f4f6; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <table>
      <tbody>${rowsHtml}</tbody>
    </table>
  </body>
</html>`);
  printableWindow.document.close();
  printableWindow.focus();
  printableWindow.print();
}
