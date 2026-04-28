# Token Generate Replacement Plan

## Scope

- Replace current token pages.
- Match reference behavior.
- Match reference API contracts.
- Match reference flow shapes.
- Keep wallet extension isolated.

## Task List

- [x] Add route coverage.
- [x] Rebuild shared toolbar.
- [x] Rebuild filter popovers.
- [x] Rebuild receipt drawer.
- [x] Rebuild credit generate.
- [x] Rebuild credit record.
- [x] Rebuild cancel flow.
- [x] Rebuild remaining pages.
- [x] Isolate wallet overlay.
- [x] Run parity QA.

## Source Truth

- Live UI: `http://8.208.16.168:9311/#/token-generate/credit-token`
- Live API base: `http://8.208.16.168:9310`
- Live frontend stack: Vue + ElementUI
- Our frontend stack: React
- Our backend stack: Express

## Reference Token Module

### Generate pages

- Credit Token
- Clear Tamper Token
- Clear Credit Token
- Set Maximum Power Limit Token
- Set Maximum Phase Power Unbalance Limit Token
- Change Meter Key Token
- Set Maximum Overdraft Limit Token
- Update Meter Key

### Record pages

- Credit Token Record
- Credit Token Cancel Record
- Clear Tamper Token Record
- Clear Credit Token Record
- Set Maximum Power Limit Token Record
- Set Maximum Phase Power Unbalance Limit Token Record
- Meter Test Token
- Change Meter Key Token Record
- Set Maximum Overdraft Limit Token Record

## Live API Endpoints

### Generate endpoints

- `POST /api/token/creditToken/generate`
- `POST /api/token/clearTamperToken/generate`
- `POST /api/token/clearCreditToken/generate`
- `POST /api/token/setMaximumPowerLimitToken/generate`
- `POST /api/token/setMaximumOverdraftLimitToken/generate`
- `POST /api/token/setMaximumPhasePowerUnbalanceLimitToken/generate`
- `POST /api/token/changeMeterKeyToken/generate`
- `POST /api/token/meterKey/update`

### Record endpoints

- `POST /api/token/creditTokenRecord/read`
- `POST /api/token/creditTokenCancelRecord/read`
- `POST /api/token/creditTokenRecord/cancel`
- `POST /api/token/clearTamperTokenRecord/read`
- `POST /api/token/clearCreditTokenRecord/read`
- `POST /api/token/setMaximumPowerLimitTokenRecord/read`
- `POST /api/token/setMaximumOverdraftLimitTokenRecord/read`
- `POST /api/token/setMaximumPhasePowerUnbalanceLimitTokenRecord/read`
- `POST /api/token/meterTestToken/read`
- `POST /api/token/changeMeterKeyTokenRecord/read`

## Current Gap

- Current page is custom.
- Current page is card-driven.
- Current page is not ElementUI-like.
- Current flow is simplified.
- Current receipt flow differs.
- Current table headers differ.
- Current filters differ.
- Current payload mapping differs.
- Current wallet logic leaks.
- Current record pages differ.

## Target UI Shape

### Page shell

- Use `app-container` layout.
- Use `filter-container` toolbar.
- Keep dense table layout.
- Keep full-width table.
- Keep fixed right actions.
- Keep server pagination.

### Toolbar

- Search term input.
- Search button.
- Reset button.
- Export button.
- Sort popover button.

### Header filters

- Popover per column.
- String filter popovers.
- Date range popovers.
- Red icon on active.
- Blue icon on idle.

### Table behavior

- Bordered table.
- Highlight current row.
- Server-side sorting.
- Server-side filtering.
- Server-side pagination.
- Fixed action column.

### Print UX

- Right-side drawer.
- Receipt preview block.
- Print button inside drawer.
- Narrow receipt width.
- Browser-specific width handling.

## Credit Token Generate

### Target flow

- Open credit token page.
- Load selectable account rows.
- Search and filter rows.
- Pick target account.
- Open generate dialog.
- Enter recharge details.
- Enter authorization password.
- Submit generate request.
- Show receipt result.
- Print receipt.
- Navigate to record page.

### Required fields

- `customerId`
- `customerName`
- `meterId`
- `tariffId`
- `stationId`
- `amount`
- `totalRecharge`
- `totalDebt`
- `payDebtPercent`
- `paymentMethod`
- `isVendByTotalPaid`
- `quotaEnabled`
- `quotaValue`
- `authorizationPassword`
- `remark`

### STS fields

- `sgc`
- `ti`
- `ken`
- `krn`
- `kt`
- `baseYear`
- `sgcNew`
- `tiNew`
- `kenNew`
- `krnNew`
- `ktNew`
- `baseYearNew`

### Generate result fields

- `receiptId`
- `customerId`
- `customerName`
- `meterId`
- `tariffId`
- `tax`
- `totalUnit`
- `totalPaid`
- `token`
- `createId`
- `createDate`
- `remark`

## Record Page Shape

### Shared columns

- `receiptId`
- `customerId`
- `customerName`
- `meterId`
- `token`
- `createDate`
- `updateDate`
- `remark`

### Credit record filters

- `receiptId`
- `customerId`
- `customerName`
- `meterId`
- `tariffId`
- `remark`
- `createDateRange`
- `updateDateRange`
- `searchTerm`
- `orderBy`
- `pageNumber`
- `pageSize`

### Credit record actions

- Print Receipt
- Cancel
- Export
- Sort
- Search
- Reset

### Cancel flow

- Open credit record page.
- Filter target record.
- Click cancel action.
- Confirm cancellation.
- Call cancel endpoint.
- Refresh source list.
- Record appears canceled.
- Cancel record page updates.

## UX Parity Tasks

### Navigation parity

- Match page names.
- Match menu grouping.
- Match route paths.
- Match route order.

### Visual parity

- Match spacing density.
- Match toolbar order.
- Match button styles.
- Match drawer width.
- Match receipt block styling.
- Match table min widths.

### Interaction parity

- Match filter popovers.
- Match enter-to-search.
- Match reset semantics.
- Match export semantics.
- Match print semantics.
- Match sort semantics.

### Data parity

- Match payload names.
- Match query names.
- Match result names.
- Match numeric coercion.
- Match null handling.
- Match status handling.

## Frontend Workstreams

### 1. Route rebuild

- Rebuild token route map.
- Remove custom page shell.
- Use reference page factory.
- Add all token pages.
- Add all record pages.

### 2. Shared token primitives

- Build ElementUI-like toolbar.
- Build column filter popovers.
- Build sort popover.
- Build receipt drawer.
- Build export helper.
- Build print helper.

### 3. Credit generate screen

- Replace current selector.
- Replace current summary cards.
- Replace custom result panel.
- Add dialog-based form.
- Add reference field order.
- Add reference validation rules.

### 4. Record screens

- Rebuild credit record page.
- Rebuild cancel record page.
- Rebuild clear token pages.
- Rebuild power-limit pages.
- Add meter test page.

### 5. State handling

- Preserve list query shape.
- Preserve sort state.
- Preserve selected row state.
- Preserve drawer state.
- Preserve dialog state.

## Backend Workstreams

### 1. Route parity

- Keep exact path casing.
- Proxy missing endpoints directly.
- Add missing token aliases.
- Preserve upstream envelopes.

### 2. Payload parity

- Stop over-normalizing fields.
- Send canonical AMR keys.
- Support live optional fields.
- Support station-specific fields.
- Support STS key fields.

### 3. Response parity

- Preserve `result.data`.
- Preserve `result.total`.
- Preserve `reason`.
- Preserve `code`.
- Preserve receipt fields.

### 4. Wallet isolation

- Split AMR base flow.
- Add wallet overlay layer.
- Gate wallet by role.
- Keep admin direct mode.
- Keep vendor linked mode.

## Replace Strategy

### Files to retire

- Current token generate shell.
- Current token record shell.
- Current receipt template.
- Current custom quote logic.
- Current custom action copy.

### Files to rebuild

- `frontend/src/pages/TokenGeneratePage.tsx`
- `frontend/src/pages/TokenRecordPage.tsx`
- `frontend/src/config/token-pages.ts`
- `frontend/src/config/page-catalog-shared.ts`
- `frontend/src/services/token-generate-flow.ts`
- `frontend/src/services/payload-mapper.ts`
- `frontend/src/services/api.ts`
- `backend/src/api/token.ts`
- `backend/src/services/upstream-request-adapters.ts`
- `backend/src/services/request-validation.ts`

## Execution Phases

### Phase 1

- Freeze current token scope.
- Audit all token routes.
- Capture live field matrix.
- Capture live record columns.
- Capture live payload samples.

### Phase 2

- Build shared reference primitives.
- Build toolbar parity.
- Build filter parity.
- Build drawer parity.
- Build print parity.

### Phase 3

- Rebuild credit token generate.
- Rebuild credit token record.
- Rebuild cancel record flow.
- Verify exact payload names.

### Phase 4

- Rebuild remaining token pages.
- Rebuild remaining record pages.
- Add meter test page.
- Add full route coverage.

### Phase 5

- Add wallet overlay hooks.
- Test admin direct flow.
- Test vendor wallet flow.
- Test fallback upstream flow.

### Phase 6

- Run parity QA.
- Fix contract drifts.
- Replace navigation entry.
- Remove obsolete code.

## QA Checklist

### Generate page

- Search works.
- Reset works.
- Sort works.
- Export works.
- Row selection works.
- Dialog validation works.
- Submit works.
- Receipt drawer works.
- Print works.

### Record page

- Filters work.
- Date filters work.
- Sort works.
- Pagination works.
- Export works.
- Print works.
- Cancel works.
- Refresh works.

### API checks

- Query keys exact.
- Body keys exact.
- Envelope shape exact.
- Error messages preserved.
- Numeric fields preserved.
- Null fields preserved.

## Acceptance

- UI matches reference.
- UX matches reference.
- Flow matches reference.
- API matches reference.
- Record pages match reference.
- Print flow matches reference.
- Wallet logic stays isolated.
- Old token UI removed.

## Risks

- Hidden live fields exist.
- Minified app hides labels.
- Wallet overlay may distort.
- Current row mappers conflict.
- Existing custom styles conflict.

## Risk Controls

- Use canonical AMR keys.
- Keep wallet adapter separate.
- Snapshot live payloads.
- Snapshot live table columns.
- Review each route manually.
- Test each token subtype.

## Recommended Order

- Credit generate first.
- Credit record second.
- Cancel flow third.
- Remaining token types fourth.
- Wallet overlay last.
