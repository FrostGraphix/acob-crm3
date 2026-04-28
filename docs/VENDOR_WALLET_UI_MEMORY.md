# Vendor Wallet UI Memory

This document stores the strict UI/UX logic and page behavior reference for vendor wallet work.

## Primary UI/UX Source

Strict replication source:
[acob-crm3-complete.tsx](C:\Users\ACOB\Downloads\acob-crm3-complete.tsx)

Repo design-system source:
[acob-design-system.tsx](C:\Users\ACOB\Desktop\VS Code\acob-crm3\docs\acob-design-system.tsx)

## Working Rule

For vendor wallet and wallet-admin pages:
- Follow the design system always.
- Replicate the UI/UX logic, layout, labels, states, and page flow from `acob-crm3-complete.tsx` as strictly as possible.
- If there is tension between the two sources:
  - visual tokens/components come from the design system
  - page structure, information hierarchy, and interaction logic come from `acob-crm3-complete.tsx`

## Strict Dashboard Reference

Admin dashboard source section:
- `function ADash({setView}: any)` in `acob-crm3-complete.tsx`

Dashboard replication rules:
- Keep the left admin rail structure and ordering aligned with the reference.
- Keep the topbar content and vendor-portal launcher aligned with the reference.
- Preserve the page header copy:
  - `Finance Dashboard`
  - timestamp line
  - reconciliation engine active status treatment
- Preserve the KPI row order:
  - Total Vendor Float
  - Total Reserved
  - Today's Purchases
  - Open Exceptions
- Preserve the main chart section:
  - Purchase Volume - Last 14 Days
  - success badge showing total
  - by-site summary bars below the chart
- Preserve the right rail blocks:
  - Wallets Near Exhaustion
  - Credit Activity Today
- Preserve the bottom three-card row:
  - Pending Funding
  - Open Exceptions
  - Manual Credit Queue

## Replication Sequence

Page-by-page order from the full UI reference:
1. Admin dashboard
2. Vendors
3. All wallets
4. Funding and credits
5. Purchase monitor
6. Exceptions
7. Settlement
8. Audit log
9. Vendor dashboard
10. Buy units
11. Fund wallet
12. Transactions
13. Receipts
14. Statement
15. Profile

## Implementation Notes

- Prefer matching copy and layout first, then connect real data where safe.
- If backend data is incomplete, use the reference structure with graceful fallbacks rather than changing the UI pattern.
- Avoid introducing new dashboard sections or alternate card arrangements unless the user explicitly asks.
