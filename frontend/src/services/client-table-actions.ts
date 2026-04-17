import type { DataRow, TableColumn } from "../types";
import { buildBrandedReceiptDocument } from "./receipt-branding";

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

function buildPrintableDocument(title: string, columns: TableColumn[], row: DataRow) {
  return buildBrandedReceiptDocument({
    documentTitle: title,
    receiptTitle: title,
    subtitle: "Official ACOB record generated from the platform.",
    badgeText: "ACOB Record",
    footerNote: "If any detail is incorrect, contact ACOB Lighting using the contact details above.",
    rows: columns.map((column) => ({
      label: column.label,
      value: readCellValue(row[column.key]) || "--",
    })),
  });
}

function printWithPopup(html: string) {
  const printableWindow = window.open("", "_blank");

  if (!printableWindow) {
    return false;
  }

  printableWindow.document.open();
  printableWindow.document.write(html);
  printableWindow.document.close();

  const finalize = () => {
    printableWindow.removeEventListener("afterprint", finalize);
    printableWindow.close();
  };

  printableWindow.addEventListener("afterprint", finalize);
  printableWindow.focus();
  window.setTimeout(() => {
    printableWindow.print();
  }, 50);

  return true;
}

function printWithIframe(html: string) {
  return new Promise<void>((resolve, reject) => {
    const iframe = document.createElement("iframe");
    let settled = false;

    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";

    const cleanup = () => {
      window.setTimeout(() => {
        iframe.remove();
      }, 0);
    };

    const resolveOnce = () => {
      if (settled) {
        return;
      }

      settled = true;
      resolve();
    };

    const rejectOnce = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      reject(error);
    };

    iframe.onload = () => {
      const printWindow = iframe.contentWindow;

      if (!printWindow) {
        cleanup();
        rejectOnce(new Error("Unable to open the print dialog"));
        return;
      }

      const finalize = () => {
        printWindow.removeEventListener("afterprint", finalize);
        cleanup();
        resolveOnce();
      };

      printWindow.addEventListener("afterprint", finalize);
      printWindow.focus();

      window.setTimeout(() => {
        try {
          printWindow.print();
          window.setTimeout(() => {
            cleanup();
            resolveOnce();
          }, 1000);
        } catch {
          cleanup();
          rejectOnce(new Error("Unable to open the print dialog"));
        }
      }, 50);
    };

    document.body.appendChild(iframe);

    const iframeDocument = iframe.contentDocument;
    if (!iframeDocument) {
      cleanup();
      rejectOnce(new Error("Unable to open the print dialog"));
      return;
    }

    iframeDocument.open();
    iframeDocument.write(html);
    iframeDocument.close();
  });
}

export async function printRowDetails(
  title: string,
  columns: TableColumn[],
  row: DataRow,
) {
  const html = buildPrintableDocument(title, columns, row);

  if (printWithPopup(html)) {
    return;
  }

  await printWithIframe(html);
}
