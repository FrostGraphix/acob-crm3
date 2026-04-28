export const BEVERLY_RECEIPT_BRAND = {
  companyName: "Beverly Technology Limited",
  website: "www.beverly.com",
  email: "info@beverly.com",
  secondaryEmail: "infobeverly@gmail.com",
  primaryPhone: "+234 704 920 2634",
  secondaryPhone: "+234 803 290 2825",
  address:
    "Plot 2, Block 14 Extension, Federal Ministry of Works and Housing Sites and Services Scheme, Setraco Gate, Gwarinpa, FCT, Nigeria",
  tagline: "Powering sustainable futures for homes, businesses, and communities.",
} as const;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

interface ReceiptRow {
  label: string;
  value: string;
}

interface BrandedReceiptDocumentOptions {
  documentTitle: string;
  receiptTitle: string;
  subtitle: string;
  rows: ReceiptRow[];
  tokenValue?: string | null;
  badgeText?: string | null;
  footerNote?: string | null;
}

export function buildBrandedReceiptDocument(options: BrandedReceiptDocumentOptions) {
  const rows = options.rows
    .map(
      (row) =>
        `<tr><th>${escapeHtml(row.label)}</th><td>${escapeHtml(row.value || "--")}</td></tr>`,
    )
    .join("");

  const tokenBlock = options.tokenValue
    ? `<div class="receipt-token">${escapeHtml(options.tokenValue)}</div>`
    : "";

  const badge = options.badgeText
    ? `<span class="receipt-badge">${escapeHtml(options.badgeText)}</span>`
    : "";

  const footer = options.footerNote
    ? `<p class="receipt-footer-note">${escapeHtml(options.footerNote)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.documentTitle)}</title>
    <style>
      @page {
        size: 60mm auto;
        margin: 8mm;
      }

      :root {
        color-scheme: light;
        --ink: #0f172a;
        --muted: #475569;
        --line: #dbe3ea;
        --panel: #ffffff;
        --soft: #f6fbfa;
        --brand: #0f766e;
        --brand-dark: #0b3b36;
        --brand-accent: #d7f0e6;
      }

      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #eef4f3; color: var(--ink); }
      body {
        font-family: "Segoe UI", Arial, sans-serif;
        padding: 14px;
        line-height: 1.34;
      }

      .receipt-page {
        width: 60mm;
        max-width: 60mm;
        margin: 0 auto;
        background: var(--panel);
        border: 1px solid rgba(15, 118, 110, 0.14);
        border-radius: 22px;
        overflow: hidden;
        box-shadow: 0 24px 64px rgba(15, 23, 42, 0.12);
      }

      .receipt-hero {
        padding: 20px 22px 16px;
        background:
          radial-gradient(circle at top right, rgba(15, 118, 110, 0.18), transparent 42%),
          linear-gradient(135deg, #f7fffc 0%, #edf7f5 52%, #fdfefe 100%);
        border-bottom: 1px solid rgba(15, 118, 110, 0.12);
      }

      .receipt-brand {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        align-items: flex-start;
        margin-bottom: 12px;
      }

      .receipt-brand-mark {
        display: grid;
        gap: 5px;
      }

      .receipt-kicker {
        margin: 0;
        color: var(--brand);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .receipt-brand h1 {
        margin: 0;
        font-size: 21px;
        line-height: 1.15;
        color: var(--brand-dark);
      }

      .receipt-tagline,
      .receipt-subtitle,
      .receipt-contact,
      .receipt-address,
      .receipt-meta,
      .receipt-footer-note {
        margin: 0;
      }

      .receipt-tagline,
      .receipt-subtitle,
      .receipt-address,
      .receipt-meta,
      .receipt-footer-note {
        color: var(--muted);
      }

      .receipt-contact {
        display: grid;
        gap: 2px;
        text-align: right;
        color: var(--brand-dark);
        font-weight: 600;
        font-size: 11px;
      }

      .receipt-title-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }

      .receipt-title {
        margin: 0 0 4px;
        font-size: 20px;
        color: var(--ink);
      }

      .receipt-badge {
        display: inline-flex;
        align-items: center;
        padding: 6px 10px;
        border-radius: 999px;
        background: var(--brand-accent);
        color: var(--brand-dark);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .receipt-body {
        padding: 16px 22px 18px;
      }

      .receipt-token {
        margin: 0 0 14px;
        padding: 12px 14px;
        border-radius: 14px;
        background: linear-gradient(135deg, #0d5f58, #15836c);
        color: #f8fffd;
        font-size: 22px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-align: center;
        word-break: break-word;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        overflow: hidden;
        border-radius: 14px;
        border: 1px solid var(--line);
        page-break-inside: avoid;
      }

      th,
      td {
        padding: 8px 10px;
        border-bottom: 1px solid var(--line);
        text-align: left;
        vertical-align: top;
        line-height: 1.24;
      }

      tr:last-child th,
      tr:last-child td {
        border-bottom: 0;
      }

      th {
        width: 34%;
        background: var(--soft);
        color: var(--brand-dark);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      td {
        color: var(--ink);
        font-weight: 600;
        font-size: 13px;
      }

      .receipt-meta {
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px dashed rgba(71, 85, 105, 0.3);
        font-size: 11px;
      }

      .receipt-footer-note {
        margin-top: 8px;
        font-size: 11px;
      }

      @media print {
        body {
          padding: 0;
          background: #fff;
        }

        .receipt-page {
          box-shadow: none;
          border: 0;
          border-radius: 0;
          width: 60mm;
          max-width: 60mm;
        }

        .receipt-hero {
          padding: 12px 14px 10px;
        }

        .receipt-body {
          padding: 10px 14px 12px;
        }

        .receipt-brand h1 {
          font-size: 18px;
        }

        .receipt-title {
          font-size: 17px;
        }

        .receipt-tagline,
        .receipt-address,
        .receipt-subtitle,
        .receipt-contact,
        .receipt-meta,
        .receipt-footer-note,
        td {
          font-size: 10px;
        }

        .receipt-kicker,
        .receipt-badge,
        th {
          font-size: 9px;
        }

        .receipt-token {
          margin-bottom: 10px;
          padding: 10px 12px;
          font-size: 18px;
        }

        th,
        td {
          padding: 6px 8px;
        }
      }
    </style>
    <script>
      (function () {
        var userAgent = navigator.userAgent || "";
        var isFirefox = userAgent.indexOf("Firefox") > -1;
        if (!isFirefox) return;
        var style = document.createElement("style");
        style.textContent = "@page { size: 49mm auto; margin: 2mm; } .receipt-page { width: 49mm; max-width: 49mm; }";
        document.head.appendChild(style);
      })();
    </script>
  </head>
  <body>
    <main class="receipt-page">
      <section class="receipt-hero">
        <div class="receipt-brand">
          <div class="receipt-brand-mark">
            <p class="receipt-kicker">Beverly Official Receipt</p>
            <h1>${escapeHtml(BEVERLY_RECEIPT_BRAND.companyName)}</h1>
            <p class="receipt-tagline">${escapeHtml(BEVERLY_RECEIPT_BRAND.tagline)}</p>
            <p class="receipt-address">${escapeHtml(BEVERLY_RECEIPT_BRAND.address)}</p>
          </div>
          <div class="receipt-contact">
            <span>${escapeHtml(BEVERLY_RECEIPT_BRAND.primaryPhone)}</span>
            <span>${escapeHtml(BEVERLY_RECEIPT_BRAND.secondaryPhone)}</span>
            <span>${escapeHtml(BEVERLY_RECEIPT_BRAND.email)}</span>
            <span>${escapeHtml(BEVERLY_RECEIPT_BRAND.website)}</span>
          </div>
        </div>
        <div class="receipt-title-row">
          <div>
            <h2 class="receipt-title">${escapeHtml(options.receiptTitle)}</h2>
            <p class="receipt-subtitle">${escapeHtml(options.subtitle)}</p>
          </div>
          ${badge}
        </div>
      </section>
      <section class="receipt-body">
        ${tokenBlock}
        <table>
          <tbody>${rows}</tbody>
        </table>
        <p class="receipt-meta">
          Verified contact: ${escapeHtml(BEVERLY_RECEIPT_BRAND.email)} | ${escapeHtml(BEVERLY_RECEIPT_BRAND.primaryPhone)} | ${escapeHtml(BEVERLY_RECEIPT_BRAND.website)}
        </p>
        ${footer}
      </section>
    </main>
  </body>
</html>`;
}
