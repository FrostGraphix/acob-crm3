# Vendor Wallet Design Memory

This document makes the vendor wallet design system a standing reference for future UI work in this repo.

## Source Of Truth

Primary design source:
[acob-design-system.tsx](C:\Users\ACOB\Desktop\VS Code\acob-crm3\docs\acob-design-system.tsx)

Primary UI/UX replication source:
[VENDOR_WALLET_UI_MEMORY.md](C:\Users\ACOB\Desktop\VS Code\acob-crm3\docs\VENDOR_WALLET_UI_MEMORY.md)

Verification:
- The repo copy matches the user-provided file from `C:\Users\ACOB\Downloads\acob-design-system.tsx`.
- SHA256: `D9F12129E30B686F60DB978542336C3963F875727D3AF3DF1405465E46630BBD`

## How To Use It

For any vendor wallet or wallet-admin UI:
- Start from the tokens, typography, spacing, radii, shadows, components, layout, animation, naming, and rules in `docs/acob-design-system.tsx`.
- Use `docs/VENDOR_WALLET_UI_MEMORY.md` as the strict page-logic and exact-replication reference.
- Treat that file as the visual authority unless the user explicitly asks for a deviation.
- Prefer extending the current vendor-wallet styles to match the design system instead of inventing new visual patterns ad hoc.
- Keep vendor wallet styling isolated from the main CRM where separation improves fidelity and reduces regressions.

## Core Visual Direction

- Light app workspace background: `#F2F4F2`
- Dark forest sidebar surfaces: `#011508`, `#021f0d`, `#013b18`
- Primary action green: `#008000`
- Brand lemon accent: `#C6E000`
- White card surfaces with soft green-tinted borders and shadows
- Typography pairing:
  - `Poppins` for interface text
  - `DM Mono` for references, tokens, IDs, timestamps, and account-like values

## Non-Negotiable Rules To Carry Forward

- Lemon backgrounds must use `#2B3300` text, never white.
- Funding screens must always preserve the “Funding != Token” distinction in the UI.
- Token display appears only in the buy-units receipt flow, not on funding screens.
- Remote-send receipts show transaction references, not generated token codes.
- Active wallet navigation should use the lemon left-border treatment, not only a background swap.
- Data-heavy wallet surfaces should continue using the prescribed badge, button, infobox, KPI, modal, and table patterns from the design system.
- Motion should stay lightweight and CSS-based, mainly using opacity, transform, and shadow transitions.

## Implementation Guidance

- When building new wallet pages, check the design system before choosing colors, spacing, or component shapes.
- Reuse existing vendor wallet primitives only when they align with this design system; otherwise update them toward the design system instead of layering conflicting styles.
- For admin wallet pages, preserve operational clarity first, but keep the same design language.
- If a screen needs a new variant, add it in a way that remains consistent with the system rather than creating one-off styling.

## Scope

This reference applies to:
- Vendor wallet pages
- Wallet admin pages
- Vendor-wallet modals, tables, receipts, forms, and alerts

This does not automatically override:
- Main CRM non-wallet surfaces
- Explicit user direction to change the visual language
