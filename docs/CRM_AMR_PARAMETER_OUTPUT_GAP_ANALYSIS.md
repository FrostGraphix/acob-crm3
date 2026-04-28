# CRM AMR Parameter And UI Gap Analysis

Date: `2026-04-23`

Baseline sources:
- Live AMR Swagger JSON: `http://8.208.16.168:9310/swagger/v1/swagger.json`
- Existing gap analysis: `docs/AMR_API_GAP_ANALYSIS.md`
- Existing reference: `docs/AMR_API_REFERENCE.md`
- Backend routes, validators, request adapters, and frontend page configs in this repository

## Executive Summary

The CRM covers many AMR paths, but it is not yet schema-complete at the parameter, output-column, and action-button level.

The largest CRM-wide issue is not missing route strings. The larger issue is that many CRM pages use local/friendly field names and reduced tables that do not expose all parameters the AMR API accepts or returns. This affects filtering, create/update forms, table display, imports, and task operation visibility.

High-risk findings:
- Customer, tariff, gateway, meter, debt, DLMS, and DLT645 create/update forms are missing Swagger-required or Swagger-native field names.
- Several table columns do not match upstream response property names, so data can be hidden even when upstream returns it.
- Missing modules still have no CRM pages, buttons, or table surfaces: `Station`, `Role`, `GPRSOnlineStatus`, `UpdateFirmwareTask`, `DailyData`, and full `User` admin CRUD/reset.
- Import buttons exist for several management pages, but backend import behavior still posts each row to `create` rather than upstream `import`.
- Token generation and remote operation pages use helpful custom flows, but they do not expose every upstream field and sometimes enforce stricter requirements than Swagger.

## Method

For each visible CRM domain, I compared:
- AMR request schema properties and required fields.
- AMR response row properties under `result.data`.
- Frontend table columns in `frontend/src/config/page-catalog-shared.ts`.
- Frontend form/action fields from management, token, report, and remote-operation page configs.
- Backend validation and adapter behavior in `backend/src/services/request-validation.ts` and `backend/src/services/upstream-request-adapters.ts`.

This report focuses on what the CRM user can actually see or submit, not only whether the backend can technically proxy an endpoint.

## CRM-Wide Patterns

### 1. Field-name alias drift

The AMR API uses exact names such as:
- `customerId`, `customerName`
- `tariffId`, `tariffName`
- `gatewayId`, `gatewayName`
- `type`, `totalDebt`, `ctRatio`, `tax`
- `currentDate`, `usage1`, `remain1`, `intervalDemand`

The CRM often uses aliases such as:
- `id`, `name`
- `meterType` instead of AMR meter `type`
- `amount` instead of AMR debt `totalDebt`
- `vatCharge` or `totalPrice` instead of AMR token fields `tax` and `totalPaid`

This causes two risks:
- Submitted create/update payloads may not match the upstream schema unless adapters remap them.
- Returned values may not render because the table column key does not match the upstream row key.

### 2. Table output is thinner than AMR response output

Most tables intentionally show a compact set of columns, but some omitted fields are operationally important:
- `createId`, `updateId`, `createDate`, `updateDate`
- `stationId`
- status fields
- debt and tax fields
- meter technical fields
- event and task IDs

### 3. Buttons/actions do not exist for whole Swagger modules

The CRM has no first-class pages/buttons for:
- `Station`
- `Role`
- `GPRSOnlineStatus`
- `UpdateFirmwareTask`
- `DailyData`
- full `User` admin CRUD/reset

These modules are not just missing table columns; they are missing full navigation, reads, create/update/delete/import buttons, and task actions.

## Module Matrix

### Account

AMR read request fields:
- `customerId`, `customerName`, `meterId`, `meterType`, `protocolVersion`, `communicationWay`, `tariffId`, `ctRatio`, `remark`, `createDateRange`, `updateDateRange`, `searchTerm`, `stationId`, `pageNumber`, `pageSize`, `orderBy`

AMR create/update fields:
- Required: `customerId`, `meterId`
- Optional: `tariffId`, `ctRatio`, `remark`, `oldMeterId`, `stationId`

CRM table/form coverage:
- Table covers `customerId`, `customerName`, `meterId`, `meterType`, `communicationWay`, `tariffId`, `protocolVersion`, `remark`, `createTime`, `stationId`.
- Form covers `customerId`, `customerName`, `meterId`, `meterType`, `communicationWay`, `tariffId`, `protocolVersion`, `remark`, `stationId`.

Gaps:
- Missing table column: `ctRatio`.
- Missing output visibility: AMR response has `status`, `createId`, `createDate`, `updateId`, `updateDate`, but CRM does not show most of these.
- Missing form field: `ctRatio`.
- Missing update form field: `oldMeterId`.
- Extra form fields not in Account write schema: `customerName`, `meterType`, `communicationWay`, `protocolVersion`.

Assessment: `Partially correct, form/schema mismatch`.

### Customer

AMR read request fields:
- `customerId`, `customerName`, `type`, `phone`, `address`, `certifiName`, `certifiNo`, `stationId`, `remark`, `createDateRange`, `updateDateRange`, `searchTerm`, `pageNumber`, `pageSize`, `orderBy`

AMR create/update fields:
- Required: `customerId`, `customerName`
- Optional: `type`, `phone`, `address`, `certifiName`, `certifiNo`, `remark`, `stationId`

CRM table/form coverage:
- Table uses `id`, `name`, `phone`, `address`, `certifiName`, `certifiNo`, `remark`, `createTime`, `updateTime`, `stationId`.
- Form uses `id`, `name`, `phone`, `address`, `certifiName`, `certifiNo`, `remark`, `stationId`.

Gaps:
- High-risk field-name mismatch: CRM uses `id`/`name`; AMR expects `customerId`/`customerName`.
- Missing customer `type` in table and form.
- Missing output visibility: `createId`, `createDate`, `updateId`, `updateDate` unless row mapper aliases them.
- Required AMR fields are not directly represented by their canonical names in the CRM form.

Assessment: `Likely wrong unless row/action mappers consistently translate id/name`.

### Tariff

AMR read request fields:
- `tariffId`, `tariffName`, `price`, `tax`, `remark`, `createDateRange`, `updateDateRange`, `searchTerm`, `stationId`, `pageNumber`, `pageSize`, `orderBy`

AMR create fields:
- Required: `tariffId`
- Optional: `tariffName`, `price`, `tax`, `remark`, `stationId`

CRM table/form coverage:
- Table uses `id`, `name`, `price`, `remark`, `createTime`, `updateTime`.
- Form uses `id`, `name`, `price`, `remark`.

Gaps:
- High-risk field-name mismatch: CRM uses `id`/`name`; AMR expects `tariffId`/`tariffName`.
- Missing `tax` in table and form.
- Missing `stationId` in table and form.
- Required AMR field `tariffId` is not submitted under its canonical name from the form.

Assessment: `Likely wrong for create/update without adapter mapping`.

### Gateway

AMR read request fields:
- `gatewayId`, `gatewayName`, `remark`, `stationId`, `createDateRange`, `updateDateRange`, `pageNumber`, `pageSize`, `orderBy`

AMR create/update fields:
- Required: `gatewayId`
- Optional: `stationId`, `gatewayName`, `remark`

CRM table/form coverage:
- Table uses `status`, `successRate`, `id`, `name`.
- Form uses `id`, `name`, `status`, `successRate`, `remark`.

Gaps:
- High-risk field-name mismatch: CRM uses `id`/`name`; AMR expects `gatewayId`/`gatewayName`.
- Missing `stationId` in table and form.
- CRM form includes `status` and `successRate`, which are not in the AMR write schema.
- Missing output fields: `remark`, `createDate`, `updateDate`.

Assessment: `Likely wrong for create/update`.

### Meter

AMR read request fields:
- `meterId`, `type`, `protocolVersion`, `communicationWay`, `isThreePhase`, `lat`, `lng`, `baseYear`, `sgc`, `krn`, `ken`, `ti`, `kt`, `baseYearNew`, `sgcNew`, `krnNew`, `kenNew`, `tiNew`, `ktNew`, `remark`, `stationId`, `createDateRange`, `updateDateRange`, `searchTerm`, `pageNumber`, `pageSize`, `orderBy`

AMR create/update fields:
- Required: `meterId`
- Optional: `type`, `isThreePhase`, `communicationWay`, `protocolVersion`, `lat`, `lng`, `remark`, `stationId`

CRM table/form coverage:
- Table uses `meterId`, `meterType`, `customerId`, `customerName`, `communicationWay`, `protocolVersion`, `gatewayId`, `stationId`, `status`, `createTime`.
- Form uses `meterId`, `meterType`, `customerId`, `customerName`, `communicationWay`, `protocolVersion`, `gatewayId`, `stationId`, `remark`.

Gaps:
- AMR field is `type`; CRM uses `meterType`.
- Missing form/table fields: `isThreePhase`, `lat`, `lng`.
- Missing key STS/security fields from read/table: `baseYear`, `sgc`, `krn`, `ken`, `ti`, `kt`, and `*New` variants.
- CRM form includes `customerId`, `customerName`, `gatewayId`, which are not in the AMR meter write schema.
- Missing output visibility: `remark`, `createId`, `updateId`, `updateDate`.

Assessment: `Partially correct for simple meter listing, incomplete for full meter maintenance`.

### Debt

AMR read request fields:
- `customerId`, `totalDebt`, `remark`, `createDateRange`, `updateDateRange`, `searchTerm`, `pageNumber`, `pageSize`, `stationId`, `orderBy`

AMR create/update fields:
- Required: `customerId`, `totalDebt`
- Optional: `stationId`, `remark`

CRM coverage:
- Debt fields exist in `page-catalog-shared.ts`, but there is no active debt management page in `management-pages.ts`.
- The available field set uses `amount` instead of AMR `totalDebt`.

Gaps:
- No visible CRUD page/buttons in the active CRM navigation.
- Field-name mismatch: `amount` vs `totalDebt`.
- Missing `stationId` in debt form.

Assessment: `Backend route exists, CRM surface missing/incomplete`.

### DLMS

AMR create/update required fields:
- `classId`, `obis`, `type`, `version`

AMR create/update optional fields include:
- `format`, `analysisFormat`, `analysisPrefixEN/AR/ES/FR/PT/ZH`, `typeEN/AR/ES/FR/PT/ZH`, `nameEN/AR/ES/FR/PT/ZH`, `remark`

CRM coverage:
- DLMS columns/forms are defined but there is no active DLMS management page in `management-pages.ts`.
- Form uses simplified fields: `name`, `obisCode`, `classId`, `attributeIndex`, `dataType`, `remark`.

Gaps:
- No active navigation/page/buttons.
- Required AMR fields `version`, `type`, and `obis` are not represented canonically.
- CRM uses `obisCode`, not AMR `obis`.
- Missing all language-specific name/type/analysis prefix fields.
- Missing `format` and `analysisFormat`.

Assessment: `Backend route exists, CRM surface missing/incompatible`.

### DLT645

AMR create/update required fields:
- `flag`, `type`, `version`

AMR create/update optional fields include:
- `control`, `password`, `operator`, `data`, `format`, `analysisFormat`, language-specific `analysisPrefix*`, `type*`, `name*`, `remark`

CRM coverage:
- DLT645 columns/forms are defined but there is no active DLT645 management page in `management-pages.ts`.
- Form uses simplified fields: `name`, `dataIdentifier`, `dataLength`, `dataType`, `remark`.

Gaps:
- No active navigation/page/buttons.
- Required AMR fields `flag`, `type`, and `version` are not exposed.
- Missing operational fields: `control`, `password`, `operator`, `data`, `format`, `analysisFormat`.
- Missing language-specific fields.

Assessment: `Backend route exists, CRM surface missing/incompatible`.

### DailyDataMeter / Interval Data

AMR read request fields:
- `currentDateRange`, `customerId`, `customerName`, `meterId`, `total1`, `gatewayId`, `total2`, `remain1`, `remain2`, `intervalDemand`, `power`, `voltageA/B/C`, `currentA/B/C`, `relayOpen`, `batteryLow`, `magneticInterference`, `terminalCoverOpen`, `coverOpen`, `source2Activated`, `currentReverse`, `currentUnbalance`, `createDateRange`, `updateDateRange`, `lang`, `searchTerm`, `stationId`, `pageNumber`, `pageSize`, `orderBy`

AMR response row fields include:
- `currentDate`, `usage1`, `usage2`, `total1`, `total2`, `remain1`, `remain2`, `intervalDemand`, `power`, voltage/current phases, relay/tamper flags, `status`, `stationId`, `gatewayId`

CRM coverage:
- Interval table uses normalized labels such as `collectionDate`, `totalEnergy`, `lastHourUsage`, `creditBalance`, `maximumDemand`, `relayStatus`, `energyStatus`, `magneticStatus`, `terminalCover`, `upperOpen`.

Gaps:
- Many table keys are normalized aliases and may not render unless row mapping translates upstream fields.
- Missing direct columns: `currentDate`, `usage1`, `usage2`, `total1`, `total2`, `remain1`, `remain2`, `intervalDemand`, `voltageA/B/C`, `currentA/B/C`, `relayOpen`, `batteryLow`, `magneticInterference`, `terminalCoverOpen`, `coverOpen`, `source2Activated`, `stationId`.
- Filters are only `searchFilter`; there is no first-class UI for `currentDateRange`, `gatewayId`, phase values, relay/tamper flags, or station.

Assessment: `Useful dashboard, incomplete AMR diagnostic table`.

### LoadProfile

AMR DailyData read request fields:
- `customerId`, `customerName`, `meterId`, `stationId`, `currentDateRange`, `remark`, `isThreePhase`, `createDateRange`, `updateDateRange`, `lang`, `searchTerm`, `pageNumber`, `pageSize`, `orderBy`

AMR response row fields:
- `customerId`, `customerName`, `meterId`, `ctRatio`, `currentDate`, `data`, `headline`, `stationId`, plus audit fields

CRM coverage:
- Table uses `meterId`, `customerName`, `collectionDate`, `value`, `unit`, `status`.

Gaps:
- Missing columns: `customerId`, `ctRatio`, `currentDate`, `data`, `headline`, `stationId`, audit fields.
- Filters do not expose `isThreePhase`, `stationId`, or `currentDateRange` explicitly.
- Existing report aliases may flatten `data/headline` into generic `value/unit`, losing raw AMR content.

Assessment: `Analytics-friendly, not raw AMR-complete`.

### Token Generation

AMR credit token request fields:
- `meterId`, `isPreview`, `isVendByTotalPaid`, `amount`, `payDebtPercent`, `authorizationPassword`, `isS2`

CRM credit token action fields:
- `amount`, `unit`, `authorizationPassword`

Gaps:
- Missing explicit fields: `isPreview`, `isVendByTotalPaid`, `payDebtPercent`, `isS2`.
- CRM requires both `amount` and `unit` at backend validation for `/api/token/creditToken/generate`, while Swagger examples indicate amount-driven vending is valid.
- Token generation reads from `/api/account/read`, so account row completeness affects token payload completeness.
- New wallet-linking changes vendor-context behavior; admin direct token generation remains a passthrough.

Assessment: `Functional for common recharge, incomplete for full token controls`.

### Token Records

AMR credit token record response row fields:
- `receiptId`, `communicationWay`, `customerId`, `customerName`, `meterId`, `meterType`, `tariffId`, `totalUnit`, `totalPaid`, `tax`, `monthlyCharge`, `totalDebt`, `remainingDebt`, `payDebt`, `token`, `tokenFirst`, `tokenSecond`, `stationId`, audit fields

CRM columns:
- `receiptId`, `customerId`, `customerName`, `meterId`, `meterType`, `tariffId`, `vatCharge`, `totalUnit`, `totalPrice`, `tokenRecharge`, `createId`, `token`, `createTime`, `remark`, `stationId`

Gaps:
- Field-name mismatches: `tax` vs `vatCharge`, `totalPaid` vs `totalPrice`.
- Missing financial/debt columns: `monthlyCharge`, `totalDebt`, `remainingDebt`, `payDebt`.
- Missing split token columns: `tokenFirst`, `tokenSecond`.
- Missing `communicationWay`.
- Cancel button exists only for credit token records, not for all record types.

Assessment: `Good operational table, incomplete financial audit table`.

### Clear / Limit / Key Token Records

Gaps:
- Clear token records omit `tariffId`, `token`, `status`, and `remark`.
- Maximum power/phase/unbalance records show only a small subset and can hide receipt, status, station, and audit fields depending on upstream shape.
- Change key record does not expose all meter-key metadata.

Assessment: `Minimal tables, likely insufficient for auditing`.

### Remote Meter Tasks

AMR create task request fields:
- Remote DLT645 task: `customerId`, `meterId`, `name`, `data`, `dataPrefix`, `remark`, `stationId`
- Transparent forwarding adds raw task content fields through `DLT645TFTaskRequest`

CRM create action fields:
- Reading: `taskName`, `scheduleDate`, `dataItem`, `readMode`
- Setting: `taskName`, `scheduleDate`, `settingKey`, `settingValue`, `valueType`
- Control: `taskName`, `scheduleDate`, `controlCommand`, `reason`, `operatorReason`
- Token: `taskName`, `scheduleDate`, `tokenType`, `tokenValue`, `operatorReason`
- Transparent forwarding: `taskName`, `scheduleDate`, `protocolMode`, `commandPayload`, `timeoutSeconds`, `operatorReason`

Gaps:
- CRM uses local abstractions that adapters must convert to `name`, `data`, and `dataPrefix`.
- Remote create forms do not expose raw `dataPrefix`.
- Task list columns miss raw `id`, `name`, `data`, `dataPrefix`, `remark`, and `lang`.
- Control task table lacks `status`, `createTime`, and `updateTime` compared with reading task table.
- Transparent forwarding task page uses generic task columns and may not show TF-specific payload/status details.

Assessment: `Good safety UX, not raw AMR-complete`.

### GPRS Meter Tasks

AMR create task request fields:
- `customerId`, `meterId`, `protocolId`, `data`, `stationId`

AMR get/update fields:
- Get filters include `id`, `customerId`, `customerName`, `meterId`, `name`, `status`, `stationId`, `remark`, dates, `lang`, pagination.
- Rows include `concentratorId`, `data`, `dataPrefix`, `status`, `stationId`.

CRM coverage:
- Combined operation monitor now surfaces GPRS and Remote sources.

Gaps:
- No explicit create pages for GPRS reading/setting/control/token tasks.
- No UI field for `protocolId`.
- Missing columns: `concentratorId`, `id`, `name`, `data`, `dataPrefix`, `remark`, `lang`.

Assessment: `Read monitoring improved, create/update schema still incomplete`.

### Prepay Reports

AMR report requests include:
- Consumption statistics: customer/meter/date filters and report-specific fields.
- Long nonpurchase: customer/meter/date and nonpurchase day range.
- Low purchase: customer/meter/date and low-limit threshold.

CRM coverage:
- Long nonpurchase and low purchase pages expose core date and threshold filters.
- Consumption statistics page exposes customer, meter, and date filters.

Gaps:
- Some report-specific fields may be hidden by local alias routes.
- Tables are compact and omit raw upstream row fields not normalized by report services.
- Station/site filters are not consistently visible.

Assessment: `Generally usable, not schema-complete`.

### Event Notification

AMR read fields:
- `meterId`, `eventCode`, `currentDateRange`, `remark`, `createDateRange`, `updateDateRange`, `lang`, `searchTerm`, `pageNumber`, `pageSize`, `orderBy`, `stationId`

CRM columns:
- `id`, `eventType`, `meterId`, `description`, `severity`, `createTime`, `status`

Gaps:
- Missing filters: `eventCode`, `currentDateRange`, `lang`, `stationId`.
- Missing output columns if upstream returns raw `eventCode`, `remark`, `stationId`, audit fields.

Assessment: `Operational feed present, raw filtering incomplete`.

### System Log

AMR read fields:
- `title`, `action`, `contentBefore`, `contentAfter`, `ipAddress`, `remark`, `stationId`, dates, search, pagination

CRM columns:
- `id`, `action`, `username`, `ipAddress`, `module`, `detail`, `createTime`

Gaps:
- Missing columns/filters: `title`, `contentBefore`, `contentAfter`, `remark`, `stationId`.
- CRM has `module/detail`, which may be local normalization and not upstream-native.

Assessment: `Useful audit surface, not raw AMR log-complete`.

## Missing Module Surfaces

These Swagger modules still need full CRM pages if the goal is complete AMR coverage:

### Station

Missing:
- Navigation section/page.
- Read table.
- Create/update/delete/import buttons.
- Fields for `StationRequest`.

Impact:
- `stationId` is central to vendor/site scoping, customer reads, tariffs, gateways, meters, tasks, and reports, but station master data cannot be managed in the CRM.

### Role

Missing:
- Role read/create/update/delete/import pages.
- `ReadDataRole` page/action.
- Buttons for permission/data-role assignment.

Impact:
- AMR authorization surfaces are not manageable from the CRM.

### GPRSOnlineStatus

Missing:
- Online status table.
- View details action.
- Update action.

Impact:
- Operators cannot inspect or change GPRS online status from the CRM, even though remote operations depend on connectivity.

### UpdateFirmwareTask

Missing:
- Firmware task monitor.
- Create firmware update task button.
- File/upload linkage.

Impact:
- Firmware operations are absent despite being documented in AMR Swagger.

### DailyData

Missing:
- Non-meter daily data pages for `/api/DailyData/read`, `/readMore`, `/readMonthly`.

Impact:
- CRM only focuses on `DailyDataMeter`, so any aggregate/non-meter daily data is invisible.

### User Admin

Missing:
- User read/create/update/delete/import/reset pages.
- Reset password button.
- Role assignment workflows tied to AMR role data.

Impact:
- Only profile/password/login surfaces are present; AMR user administration is incomplete.

## Button / Action Gap Summary

Present:
- Management pages have Add, Import, Export, Edit, Delete, and bulk delete where pages exist.
- Token records have Print and credit-token Cancel.
- Remote operations have create/review flows and retry/update on task pages.
- Reports have export and some drilldowns.

Missing or wrong:
- Import buttons do not call upstream `import`; backend bulk import loops over `create`.
- Station, Role, GPRSOnlineStatus, UpdateFirmwareTask, DailyData, and User Admin have no buttons because they have no pages.
- GPRS create buttons are not first-class; the UI mainly creates RemoteMeterTask tasks.
- Firmware create/get buttons are absent.
- Token record cancel is only exposed for credit records.
- No "view raw AMR row" action exists for diagnostic tables, making hidden output fields hard to inspect.
- No "column chooser" exists for tables with many upstream fields.

## Correct / Wrong / Missing

### Correct

- Core route coverage for Account, Customer, Meter, Tariff, Gateway, Token, RemoteMeterTask, GPRSMeterTask, DailyDataMeter, LoadProfile, EventNotification, Log, and PrepayReport is present.
- Remote operation UX adds useful high-risk safeguards.
- Combined task monitoring now shows remote/GPRS source channels.
- Wallet-linked vendor token/remote-send behavior is now aligned with wallet purchase history.

### Wrong

- Customer form/table uses `id` and `name` where upstream requires/returns `customerId` and `customerName`.
- Tariff form/table uses `id` and `name` where upstream uses `tariffId` and `tariffName`.
- Gateway form/table uses `id` and `name` where upstream uses `gatewayId` and `gatewayName`.
- Debt form uses `amount` where upstream uses required `totalDebt`.
- Token record table uses `vatCharge`, `totalPrice`, and `tokenRecharge` where upstream returns `tax`, `totalPaid`, and token/debt fields.
- Import behavior still uses upstream create endpoints instead of upstream import endpoints.

### Missing

- Required or important write fields:
  - Account: `ctRatio`, `oldMeterId`
  - Customer: `type`, canonical `customerId/customerName`
  - Tariff: `tax`, `stationId`, canonical `tariffId/tariffName`
  - Gateway: `stationId`, canonical `gatewayId/gatewayName`
  - Meter: `type`, `isThreePhase`, `lat`, `lng`
  - Debt: `totalDebt`, `stationId`
  - DLMS: `version`, `type`, `obis`, `format`, multilingual fields
  - DLT645: `version`, `type`, `flag`, `control`, `password`, `operator`, `data`
  - GPRS task create: `protocolId`
- Output/table fields:
  - Raw audit fields across most modules: `createId`, `createDate`, `updateId`, `updateDate`
  - Station/site fields across tariff, gateway, reports, events, and logs
  - Technical meter fields for STS/key configuration
  - DailyDataMeter phase values and tamper flags
  - Token financial debt/tax fields
  - Task `id`, `name`, `data`, `dataPrefix`, `concentratorId`

## Priority Implementation Plan

1. Add a schema-aware row mapper and field alias map.
   - Map CRM aliases to AMR names before submit: `id -> customerId/tariffId/gatewayId` depending on module, `name -> customerName/tariffName/gatewayName`, `amount -> totalDebt`, `meterType -> type`.
   - Map AMR response names back to current UI aliases only where needed.

2. Fix management forms for Customer, Tariff, Gateway, Meter, Account, and Debt.
   - Add missing required fields.
   - Use canonical AMR field keys in submitted payloads.
   - Keep user-friendly labels, but do not use wrong payload keys.

3. Add column coverage controls.
   - Add a "View Raw" row action.
   - Add optional/advanced columns for audit fields, station fields, debt/tax fields, and meter technical fields.

4. Fix import behavior.
   - Rewire import actions to upstream `import` endpoints or create a separate "bulk create" label if the current behavior is intentional.

5. Add missing CRM pages.
   - Station
   - Role and ReadDataRole
   - GPRSOnlineStatus read/view/update
   - UpdateFirmwareTask get/create
   - DailyData read/readMore/readMonthly
   - User admin read/create/update/delete/import/reset

6. Expand token and task records.
   - Add financial/debt/tax columns to token records.
   - Add raw task id/name/data/dataPrefix/concentrator columns.
   - Add GPRS create task flows or protocol-aware routing from existing remote pages.

## Bottom Line

The CRM is operationally useful, but it is not yet an AMR-schema-complete client. The next implementation should focus on canonical field names, missing required write fields, hidden response columns, and missing module pages/buttons.

If we fix only endpoint coverage without fixing field names and table output coverage, the CRM will still appear connected while silently dropping important AMR data.
