# AMR Reference Replication Implementation Plan

## Goal

Replicate the original AMR web app at `http://8.208.16.168:9311` end to end using its API at `http://8.208.16.168:9310`, while keeping ACOB wallet/vendor functionality as an explicit extension layer.

The reference app is a Vue/ElementUI AMR system. The CRM target is React/Express, so the implementation should copy behavior, navigation, data contracts, chart logic, table actions, and button workflows rather than the exact framework internals.

## Source Truth

- Live SPA: `http://8.208.16.168:9311`
- API base configured by live SPA: `http://8.208.16.168:9310`
- Dashboard cards API: `/api/dashboard/readPanelGroup`
- Dashboard chart API: `/api/dashboard/readLineChart`
- Primary UI library behavior to mirror: ElementUI cards, filters, table toolbar actions, row actions, modal forms, pagination, imports, exports, and receipt printing.

## Exact Dashboard Task

Status: implemented in this pass.

Reference behavior:

- Four clickable count cards:
  - `Account Count` from `totalAccountCount`
  - `Purchase Times` from `totalPurchaseTimes`
  - `Purchase Unit` from `totalPurchaseUnit`
  - `Purchase Money` from `totalPurchaseMoney`
- Cards call `/api/dashboard/readLineChart` with:
  - `{ type: 0, days: 30 }` for account count chart
  - `{ type: 1, days: 30 }` for purchase times chart
  - `{ type: 2, days: 30 }` for purchase unit chart
  - `{ type: 3, days: 30 }` for purchase money chart
- Initial top chart is Purchase Money, type `3`.
- Daily consumption chart calls `{ type: 4, days: 30 }`.
- Communication success rate line chart calls `{ type: 6, days: 48 }`.
- Abnormal alarm rose pie chart calls `{ type: 7, days: 1 }`.
- The consumption section includes a `Daily` radio button and `More >` link to `/#/prepay-report/daily-data-meter`.

Implementation notes:

- Frontend now uses ECharts options matching the reference chart definitions.
- Backend now preserves original dashboard chart type semantics before applying local fallback data.

## End-To-End Replication Phases

### Phase 1: API Alias Compatibility

Add lowercase live-site aliases for every endpoint found in the compiled app, while preserving current Swagger/uppercase paths.

Priority aliases:

- `/api/remoteMeterTask/createReadingTask`
- `/api/remoteMeterTask/createSettingTask`
- `/api/remoteMeterTask/createControlTask`
- `/api/remoteMeterTask/createTokenTask`
- `/api/remoteMeterTask/CreateTransparentForwardingTask`
- `/api/remoteMeterTask/getReadingTask`
- `/api/remoteMeterTask/getSettingTask`
- `/api/remoteMeterTask/getControlTask`
- `/api/remoteMeterTask/getTokenTask`
- `/api/remoteMeterTask/GetTransparentForwardingTask`
- `/api/remoteMeterTask/updateReadingTask`
- `/api/remoteMeterTask/updateSettingTask`
- `/api/remoteMeterTask/updateControlTask`
- `/api/remoteMeterTask/updateTokenTask`
- `/api/updateFirmwareTask/createUpdateFirmwareTask`
- `/api/updateFirmwareTask/getUpdateFirmwareTask`
- `/api/loadProfile/electricEnergyCurve`
- `/api/loadProfile/instantaneousValueCurve`
- `/api/loadProfile/dailyData`
- `/api/loadProfile/monthlyData`
- `/api/dailyData/read`
- `/api/dailyData/readMore`
- `/api/dailyData/readMonthly`
- `/api/gprsOnlineStatus/read`
- `/api/gprsOnlineStatus/view`
- `/api/eventNotification/read`
- `/api/file/upload`
- `/api/file/uploadBin`

Acceptance:

- Every live-site endpoint resolves locally.
- Existing uppercase/Swagger endpoints continue to work.
- Endpoint registry recognizes both forms.

### Phase 2: Reference Navigation

Create an AMR reference navigation mode with these sections:

- Dashboard
- Token Generate
- Token Record
- Remote Operation
- Remote Operation GPRS
- Remote Operation Record
- Remote Operation Record GPRS
- Remote Report
- Prepay Report
- Management
- Setting
- Profile

Acceptance:

- Page names and grouping match the live site.
- Wallet/vendor pages remain available as ACOB extensions, not mixed into the AMR reference sections.

### Phase 3: Remote Operations

Normal remote operation pages:

- Meter Reading
- Meter Setting
- Meter Control
- Meter Token
- Transparent Forwarding
- Update Firmware

GPRS remote operation pages:

- GPRS Meter Reading
- GPRS Meter Setting
- GPRS Meter Control
- GPRS Meter Token

Fields to support:

- `customerId`
- `customerName`
- `meterId`
- `meterType`
- `communicationWay`
- `protocolVersion`
- `stationId`
- `dataItem`
- `dataFormat`
- `dataFormatType`
- `sendFrame`
- `token`
- `fileName`
- `fileType`
- `remark`

Acceptance:

- Normal task pages and GPRS task pages are visually separate.
- Each create page redirects to its matching record page.
- Record pages support read and update/retry actions.

### Phase 4: Remote Reports

Implement reference report variants:

- Daily Data
- Daily Data CT
- Daily Data Three
- Daily Data Meter
- Electric Energy Curve
- Electric Energy Curve CT
- Electric Energy Curve Three
- Instantaneous Value Curve
- Instantaneous Value Curve CT
- Instantaneous Value Curve Three
- Monthly Data
- Monthly Data CT
- Monthly Data Three
- Event Notification
- GPRS Online Status

Acceptance:

- Each page has the reference filter bar, table, export button, pagination, and live API endpoint.
- CT and Three variants share configurable page factories but remain separate navigation entries.

### Phase 5: Token Generate And Records

Reference token pages:

- Credit Token
- Clear Tamper Token
- Clear Credit Token
- Set Maximum Power Limit Token
- Set Maximum Phase Power Unbalance Limit Token
- Change Meter Key Token
- Set Maximum Overdraft Limit Token
- Update Meter Key

Reference record pages:

- Credit Token Record
- Credit Token Cancel Record
- Clear Tamper Token Record
- Clear Credit Token Record
- Set Maximum Power Limit Token Record
- Set Maximum Phase Power Unbalance Limit Token Record
- Meter Test Token
- Change Meter Key Token Record
- Set Maximum Overdraft Limit Token Record

Fields to support:

- `amount`
- `totalRecharge`
- `totalDebt`
- `payDebtPercent`
- `paymentMethod`
- `isVendByTotalPaid`
- `quotaEnabled`
- `quotaValue`
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
- `authorizationPassword`

Acceptance:

- Credit token flow is wallet-linked for vendors.
- Admin token generation can still call upstream directly.
- Receipt preview/print matches the reference receipt workflow.
- Cancel flow uses `/api/token/creditTokenRecord/cancel`.

### Phase 6: Management And Setting

Management pages:

- Customer
- Account
- Tariff
- Gateway
- Meter
- Debt
- Station
- Role
- User

Setting page:

- Item

Shared toolbar:

- Add
- Edit
- Delete
- Import
- Export
- Search/filter
- Pagination

Acceptance:

- Forms use reference field names.
- Import supports pasted CSV/JSON and native AMR batch import.
- Role/user pages honor AMR permissions.

### Phase 7: Permission Compatibility

Map AMR permission strings to CRM route access:

- `Management.Customer`
- `Management.Account`
- `Management.Tariff`
- `Management.Gateway`
- `Management.Meter`
- `Management.Debt`
- `RemoteMeterTask.CreateReadingTask`
- `RemoteMeterTaskRecord.GetReadingTask`
- `GPRSMeterTask.GPRSCreateReadingTask`
- `GPRSMeterTaskRecord.GPRSGetReadingTask`
- `RemoteReport.DailyData`
- `PrepayReport.ConsumptionStatistics`
- `System.Log`

Acceptance:

- Imported AMR users/roles can see equivalent CRM pages.
- ACOB admin/vendor roles continue to work.

### Phase 8: Verification Matrix

Create a page-by-page verification table with:

- Reference path
- CRM path
- Read endpoint
- Create endpoint
- Update endpoint
- Delete endpoint
- Import endpoint
- Buttons present
- Table columns present
- Form fields present
- Status: exact, compatible, enhanced, missing

Acceptance:

- The matrix is updated after each implementation slice.
- No page is marked exact without a manual/API-backed verification pass.

## Clarity Questions For Next Pass

1. Should the AMR reference navigation become the default sidebar, with wallet/vendor pages moved into an `ACOB Extensions` section?
2. Should DLT645 and DLMS remain completely hidden in the UI, even though their backend compatibility routes exist?
3. For receipt printing, should we copy the original `60mm/49mm` receipt sizing exactly or use ACOB-branded receipts with the same data fields?
