# Frontend Design System

This frontend now has a dedicated design-system layer that sits above the legacy page CSS and below page-specific feature styling.

## Structure

- `frontend/src/design-system/tokens.css`
  - Semantic color, spacing, radius, shadow, motion, and typography tokens
  - Light and dark theme values
  - Compatibility aliases for existing `--acob-*` and shell variables
- `frontend/src/design-system/primitives.css`
  - Reusable visual primitives such as surfaces, buttons, badges, page headers, fields, and shared status states
- `frontend/src/design-system/components.tsx`
  - Reusable React primitives:
    - `Button`
    - `Badge`
    - `Field`
    - `PageHeader`
    - `Surface`
    - `SurfaceHeader`
- `frontend/src/design-system/index.ts`
  - Public export surface for the primitives

## Adoption Rules

When building or editing frontend UI:

1. Start with semantic tokens in `tokens.css`
2. Prefer a design-system primitive before creating a new one-off wrapper
3. Add feature-specific styles only after checking whether the pattern belongs in `primitives.css`
4. Keep page files focused on composition, not low-level visual rules

## Current Coverage

The design system is now wired into the shared shell and the most reused UI paths:

- Header and tab interactions
- Search and data page toolbars
- Data tables and row status badges
- Modal actions and form fields
- Report page headers, control toggles, and tab strips
- Dashboard and data-page content surfaces

## Why This Structure

The existing frontend had strong visuals but too much shared styling duplicated across large CSS files. The design-system layer gives the project:

- A single semantic token source
- Reusable React primitives for repeated UI patterns
- Safer gradual migration from legacy CSS
- Better consistency across dashboard, data, and reporting views

## Extending It

Add new patterns only when they are reused or clearly cross-cutting. If a style is local to one page, keep it in the feature stylesheet. If the same shape appears in multiple places, promote it into the design system.
