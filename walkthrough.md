# ACOB CRM3 Walkthrough

## Phase 13: Statistical Summary Overlays
- `frontend/src/pages/ReportsPage.tsx` renders stat cards above the active report surface.
- `frontend/src/services/report-analytics.ts` derives report-specific summary metrics from real loaded upstream rows.
- Consumption views support `Daily` and `Monthly` trend grouping.

## Phase 14: Visual Trend Integration
- Reports expose `Data` and `Chart` modes in `frontend/src/pages/ReportsPage.tsx`.
- `frontend/src/components/charts/TrendChart.tsx` renders the active analytical view.
- CSV export remains available from the report header against the currently loaded dataset.

## Phase 15: Branding Sync With ACOB Lighting
- `frontend/index.html` loads `Plus Jakarta Sans`.
- `frontend/src/index.css` now centralizes ACOB brand tokens for:
  - green/yellow palette
  - light and dark surface variables
  - rounded panel/button radii
  - glassmorphism panel backgrounds
  - layered premium shadows
- `frontend/src/components/common/ThemeToggle.tsx` now uses a segmented control rather than a plain select.
- Header, sidebar, panels, buttons, pagination, tables, and notifications all inherit the same design-system surface treatment.

## Verification Notes
- Browser-subagent style visual verification is not available in this CLI environment.
- Validation completed through static UI audit plus:
  - `npm.cmd --prefix frontend run lint`
  - `npm.cmd --prefix frontend run typecheck`
  - `npm.cmd --prefix frontend run build`
