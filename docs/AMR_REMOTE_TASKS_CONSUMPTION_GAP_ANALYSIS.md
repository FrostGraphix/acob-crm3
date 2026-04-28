# AMR Remote Tasks And Consumption Gap Analysis

Focused areas:
- GPRS task operations
- Remote meter task operations
- Remote token send
- Exact consumption data
- Per-user/unit usage
- Day, week, month, year, and overall consumption analysis

Source references:
- Live Swagger: http://8.208.16.168:9310/index.html
- General reference: [AMR_API_REFERENCE.md](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/docs/AMR_API_REFERENCE.md)
- General project gap analysis: [AMR_API_GAP_ANALYSIS.md](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/docs/AMR_API_GAP_ANALYSIS.md)

Date:
- `2026-04-23`

## Executive Summary

The project is strongest around remote task passthrough and task monitoring. Remote operations are wired, guarded, audited, and visible in the frontend.

The biggest gaps are not basic route coverage. The bigger gaps are data precision and operational certainty:

- GPRS task routes are exposed, but live sampled GPRS task monitors currently returned zero task rows.
- Remote token send is custom and sophisticated, but it depends on token-generation success, permission checks, environment configuration, and fallback delivery paths.
- Wallet purchase remote delivery is still simulated, not a real upstream remote send.
- Meter consumption data is available at meter/day or interval/report level, but not at appliance level.
- The current consumption analytics do not reliably provide true day/week/month/year/overall history unless the backing upstream query or persisted fact tables contain that time range.

Most important conclusion:

The system can answer "how much energy a meter/customer/site used over time" when upstream rows exist. It cannot honestly answer "which connected appliance used exactly how many units" because the upstream AMR schemas do not expose appliance-level telemetry.

## Live Validation Snapshot

Using configured upstream authentication without exposing secrets, these live upstream endpoints were sampled with small page sizes:

- `/api/DailyDataMeter/read`: success, rows returned, total around `225,917`
- `/api/DailyDataMeter/readMore`: success, rows returned, total around `3,291,764`
- `/API/RemoteMeterTask/GetReadingTask`: success, rows returned, total around `178`
- `/API/RemoteMeterTask/GetControlTask`: success, rows returned, total around `55`
- `/API/RemoteMeterTask/GetTokenTask`: success, rows returned, total around `2,075`
- `/API/GPRSMeterTask/GPRSGetReadingTask`: success, zero rows
- `/API/GPRSMeterTask/GPRSGetSettingTask`: success, zero rows
- `/API/GPRSMeterTask/GPRSGetControlTask`: success, zero rows
- `/API/GPRSMeterTask/GPRSGetTokenTask`: success, zero rows
- `/API/LoadProfile/DailyData`: success, zero rows for the sampled generic query

Interpretation:

- Remote task monitoring has real upstream data.
- Daily meter readings have real upstream data.
- GPRS task endpoints are valid but currently not showing task queue data for a generic query.
- Load profile endpoints may require stricter meter/date filters or may not be populated for the generic query.

## Remote Operation Coverage

### Correctly Exposed Remote Task Endpoints

The backend exposes the full upstream `RemoteMeterTask` surface:

- `/API/RemoteMeterTask/CreateReadingTask`
- `/API/RemoteMeterTask/CreateSettingTask`
- `/API/RemoteMeterTask/CreateControlTask`
- `/API/RemoteMeterTask/CreateTokenTask`
- `/API/RemoteMeterTask/CreateTransparentForwardingTask`
- `/API/RemoteMeterTask/GetReadingTask`
- `/API/RemoteMeterTask/GetSettingTask`
- `/API/RemoteMeterTask/GetControlTask`
- `/API/RemoteMeterTask/GetTokenTask`
- `/API/RemoteMeterTask/GetTransparentForwardingTask`
- `/API/RemoteMeterTask/UpdateReadingTask`
- `/API/RemoteMeterTask/UpdateSettingTask`
- `/API/RemoteMeterTask/UpdateControlTask`
- `/API/RemoteMeterTask/UpdateTokenTask`

Backend route file:
- [remote.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/remote.ts)

Frontend route configuration:
- [remote-pages.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/frontend/src/config/remote-pages.ts)

Assessment:
- `Correct coverage`

### Remote Task Request Mapping

Swagger expects:

```json
[
  {
    "customerId": "string",
    "meterId": "string",
    "version": "string",
    "flag": "string",
    "dataDefault": "string",
    "data": "string",
    "stationId": "string"
  }
]
```

The project frontend/backend works with richer local payloads such as:

- `target.meterId`
- `target.customerId`
- `taskName`
- `taskType`
- `dataItem`
- `controlCommand`
- `operatorReason`
- `reviewConfirmed`
- `tokenType`
- `tokenValue`
- `protocolMode`
- `commandPayload`

Then [upstream-request-adapters.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/services/upstream-request-adapters.ts) converts those local payloads into candidate upstream payloads.

Assessment:
- `Useful abstraction`, but not a strict Swagger schema mirror

Risk:
- The adapter tries several candidate body shapes, which improves survival against upstream uncertainty but makes exact request behavior harder to prove.

### Remote High-Risk Safeguards

Remote operations add local guardrails not present in Swagger:

- `reviewConfirmed` is required for control, token, and transparent forwarding tasks.
- `operatorReason` must be present for high-risk tasks.
- `target.meterId` is required.
- Control command is restricted to `connect`, `disconnect`, `open`, or `close`.

Implementation:
- [request-validation.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/services/request-validation.ts)

Assessment:
- `Correct and desirable local hardening`

## GPRS Task Coverage

### Correctly Exposed GPRS Endpoints

The backend exposes the full upstream `GPRSMeterTask` surface:

- `/API/GPRSMeterTask/GPRSCreateReadingTask`
- `/API/GPRSMeterTask/GPRSCreateSettingTask`
- `/API/GPRSMeterTask/GPRSCreateControlTask`
- `/API/GPRSMeterTask/GPRSCreateTokenTask`
- `/API/GPRSMeterTask/GPRSGetReadingTask`
- `/API/GPRSMeterTask/GPRSGetSettingTask`
- `/API/GPRSMeterTask/GPRSGetControlTask`
- `/API/GPRSMeterTask/GPRSGetTokenTask`
- `/API/GPRSMeterTask/GPRSUpdateReadingTask`
- `/API/GPRSMeterTask/GPRSUpdateSettingTask`
- `/API/GPRSMeterTask/GPRSUpdateControlTask`
- `/API/GPRSMeterTask/GPRSUpdateTokenTask`

Backend route file:
- [gprs-meter-task.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/gprs-meter-task.ts)

Swagger request shape for create:

```json
[
  {
    "customerId": "string",
    "meterId": "string",
    "protocolId": 0,
    "data": "string",
    "stationId": "string"
  }
]
```

Swagger request shape for get:

```json
{
  "meterId": "string",
  "status": 0,
  "lang": "en",
  "pageNumber": 1,
  "pageSize": 20
}
```

Assessment:
- `Correct coverage`

### GPRS Task Functional Gap

Live sampled GPRS task reads returned success with zero rows:

- GPRS reading tasks: zero rows
- GPRS setting tasks: zero rows
- GPRS control tasks: zero rows
- GPRS token tasks: zero rows

This does not mean the routes are broken. It means the current generic task monitor query does not prove the presence of queued or historical GPRS tasks.

Most likely causes:

- No current GPRS task data exists.
- The query needs station, meter, status, or date filters.
- Permission scope may allow endpoint access but not specific station data.
- The system is using remote task queues more heavily than GPRS task queues.

Assessment:
- `Route coverage correct, operational proof incomplete`

Recommended next validation:

- Create a controlled GPRS token or reading task for a known GPRS meter.
- Immediately query `GPRSGet...Task` with that meterId and stationId.
- Verify task appears and status changes.

## Remote Send Token

### Current Backend Flow

The main custom route is:

- `/api/token/remote-send`

Implementation:
- [token.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/token.ts)
- [remote-token-send.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/services/remote-token-send.ts)

Frontend remote-token operation points here:
- [remote-pages.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/frontend/src/config/remote-pages.ts)

The backend flow:

1. Resolve selected meter/customer/station from the row.
2. Generate a token using `/api/token/creditToken/generate` or `/api/token/clearCreditToken/generate`.
3. Extract the generated token value.
4. Decide whether the meter looks like direct GPRS.
5. If direct GPRS is likely, attempt `/API/GPRSMeterTask/GPRSCreateTokenTask`.
6. If GPRS delivery fails or is not suitable, fall back to `/API/RemoteMeterTask/CreateTokenTask`.
7. Audit the result and return delivery details.

Assessment:
- `Sophisticated and mostly correct`

### Remote Send Token Risks

The flow depends on several fragile conditions:

- `REMOTE_SEND_AUTHORIZATION_PASSWORD` must be configured.
- Token generation must return a token value in one of the expected fields.
- GPRS permission must include `GPRSMeterTask.GPRSCreateTokenTask`.
- The meter row must include enough protocol/station information to choose GPRS correctly.
- Several candidate payloads are attempted because the exact upstream payload accepted by the server is not fully known.

Risk details:

- If tariff/rate lookup fails, the code can fall back to `1-to-1` naira-to-unit conversion.
- That fallback is operationally dangerous for real vending because it can produce incorrect unit/amount mapping.
- The function reports `pricingSource`, which is good, but the system should ideally block remote send when pricing cannot be resolved.

Assessment:
- `Operationally useful, but needs stricter production safeguards`

### Wallet Remote Purchase Gap

Wallet purchase remote delivery is not actually calling upstream.

Implementation:
- [wallet-purchase-remote.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/services/wallet-purchase-remote.ts)

Current mode:
- `simulated`

Impact:
- Vendor wallet remote purchases may appear successful locally without creating a real upstream remote task.

Assessment:
- `Major gap`

Recommendation:
- Replace the simulated wallet remote service with the same real delivery pipeline used by `/api/token/remote-send`.

## Task Operation Monitoring

### Current Task Monitor Coverage

The frontend exposes remote task pages for:

- meter reading task
- meter setting task
- meter control task
- meter token task
- transparent forwarding task

The token task page combines:

- `/API/GPRSMeterTask/GPRSGetTokenTask`
- `/API/RemoteMeterTask/GetTokenTask`

Implementation:
- [token.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/token.ts)

Assessment:
- `Good UX abstraction`

### Task Monitor Gaps

The project currently combines only token tasks across GPRS and remote sources.

Gap:
- Reading, setting, and control task pages use only `RemoteMeterTask` endpoints.
- GPRS reading, setting, and control task monitors exist at the backend, but are not clearly surfaced as first-class frontend task pages.

Impact:
- Operators may miss GPRS task state unless they use a lower-level route or unless the remote task page happens to cover their meter type.

Recommendation:
- Add combined task monitors for reading, setting, and control just like token tasks.
- Each combined monitor should show source: `remote-task` or `gprs-task`.

## Consumption Data Coverage

### Available Upstream Data

The upstream API exposes meter consumption-related data through:

- `/api/DailyDataMeter/read`
- `/api/DailyDataMeter/readMore`
- `/api/DailyDataMeter/readMonthly`
- `/api/DailyData/read`
- `/api/DailyData/readMore`
- `/api/DailyData/readMonthly`
- `/API/LoadProfile/DailyData`
- `/API/LoadProfile/MonthlyData`
- `/API/LoadProfile/ElectricEnergyCurve`
- `/API/LoadProfile/InstantaneousValueCurve`
- `/API/PrepayReport/ConsumptionStatistics`

Live data is strongest on:

- `/api/DailyDataMeter/read`
- `/api/DailyDataMeter/readMore`

The sampled rows include:

- `currentDate`
- `customerId`
- `customerName`
- `meterId`
- `usage1`
- `usage2`
- `total1`
- `total2`
- `remain1`
- `remain2`
- `intervalDemand`
- `power`
- `voltageA/B/C`
- `currentA/B/C`
- event flags
- `stationId`
- `gatewayId`

Assessment:
- `Good meter-level AMR data`

### Backend Consumption Implementation

The project currently has multiple consumption paths:

- direct interval data via `/api/DailyDataMeter/read`
- report aliases via `/api/reports/consumption`
- site consumption snapshots via `/api/site-consumption/report`
- customer recharge vs consumption via `/api/customer/consumption-recharge-summary`
- daily customer recharge vs consumption via `/api/customer/consumption-recharge-daily`
- live daily customer consumption via `/api/customer/live-daily-consumption`

Implementation:
- [site-consumption.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/site-consumption.ts)
- [site-consumption-engine.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/services/site-consumption-engine.ts)
- [customer-analytics.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/services/customer-analytics.ts)

Assessment:
- `Good foundation`, but not complete for all requested time windows

## Exact Unit Usage By User

### What The Project Can Do

The project can approximate or calculate per-meter/per-customer kWh usage when daily meter rows exist.

Supported facts:

- meter id
- customer id/name when upstream row or master data provides it
- station/site
- consumption-like fields such as `usage1`, `usage2`, `total1`, `total2`, `totalEnergy`, `kwh`, or `usedEnergy`
- current and voltage fields for electrical status
- daily summaries if rows can be grouped by date

### What The Project Cannot Honestly Do Yet

It cannot identify exact unit consumption by individual connected appliances.

Reason:
- The upstream Swagger schemas do not expose appliance ids, appliance circuits, socket ids, device fingerprints, NILM classifications, or submeter channels.
- The sampled meter rows are meter-level AMR rows, not appliance-level rows.
- Current backend models do not persist an appliance usage table.

Assessment:
- `Appliance-level exact usage is not supported by upstream or project code`

Required to support it:

- smart plug/submeter telemetry
- appliance registry per customer/meter
- circuit/channel mapping
- load disaggregation model with confidence scoring
- separate `appliance_usage_facts` or equivalent table

Without those, any "appliance usage" would be a guess, not a fact.

## Consumption Analysis By Time Window

### Day

Current support:
- Good when `/api/DailyDataMeter/read` returns rows for the selected day.
- `/api/customer/live-daily-consumption` supports today-only customer consumption.

Gap:
- The frontend does not expose a dedicated per-customer daily history dashboard with guaranteed day selection and exact row provenance.

Assessment:
- `Partially supported`

### Week

Current support:
- Can be computed from daily rows over seven days if data is available.

Gap:
- No explicit weekly endpoint or first-class weekly aggregation in the backend.
- Weekly views would need to be derived from daily facts.

Assessment:
- `Derivable but not first-class`

### Month

Current support:
- `/api/DailyDataMeter/readMonthly`
- `/API/LoadProfile/MonthlyData`
- site consumption monthly snapshot

Gap:
- Existing site-consumption engine only refreshes a recent short source window by default.
- Monthly may be empty or incomplete unless persisted facts or upstream query covers the full month.

Assessment:
- `Partially supported`

### Year

Current support:
- Site-consumption report has `yearly` granularity.

Gap:
- The current site-consumption engine fetches a recent source window, then derives yearly from that window.
- That is not a true full-year total unless the source window spans the whole year.

Assessment:
- `Structurally present, data coverage insufficient`

### Overall

Current support:
- No true all-time consumption endpoint in the backend.
- Could be derived only if all historical daily facts are persisted.

Gap:
- No durable all-time backfill pipeline is evident.

Assessment:
- `Not supported as exact all-time`

## Critical Data Quality Gap

The site-consumption engine currently refreshes a recent window:

- It starts at today minus roughly two days.
- It accumulates daily/monthly/yearly summaries from that short window.

Implementation:
- [site-consumption-engine.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/services/site-consumption-engine.ts)

Impact:
- Daily can be useful.
- Weekly may be incomplete.
- Monthly/yearly/overall can be misleading if treated as full-period totals.

Recommendation:
- Add historical backfill jobs for daily meter reads.
- Store normalized facts by `meter_id`, `site_id`, `read_date`, and `consumption_kwh`.
- Build week/month/year/overall from persisted facts, not from a two or three day live snapshot.

## Recommended Priority Plan

### Priority 1: Remote Operations

- Keep existing remote task endpoints.
- Add combined GPRS + Remote monitors for reading, setting, and control tasks.
- Preserve current high-risk validation.
- Add explicit task-source column everywhere: `remote-task` or `gprs-task`.
- Add a controlled task lifecycle test for each operation type.

### Priority 2: Remote Token Send

- Block remote token send when pricing source falls back to `fallback-1-to-1`.
- Replace wallet remote purchase simulation with the real `/api/token/remote-send` pipeline.
- Add a clear delivery state: `generated-only`, `queued-gprs`, `queued-remote`, `failed`.
- Persist generated token and delivery task id safely with token masking in logs.

### Priority 3: Exact Meter Consumption

- Normalize `/api/DailyDataMeter/read` and `/api/DailyDataMeter/readMore` into a durable daily meter facts table.
- Backfill at least 12 months.
- Add explicit endpoints:
  - `/api/consumption/meter/daily`
  - `/api/consumption/meter/weekly`
  - `/api/consumption/meter/monthly`
  - `/api/consumption/meter/yearly`
  - `/api/consumption/meter/overall`

### Priority 4: User-Level Consumption

- Join meter facts to account/customer mappings.
- Produce user/customer summaries from meter facts.
- Track data quality: missing customer mapping, missing site, duplicate reads, estimated rows.

### Priority 5: Appliance-Level Usage

- Do not claim exact appliance usage from AMR meter data alone.
- If this is a business requirement, add separate appliance telemetry or load-disaggregation architecture.
- Label any inferred appliance estimates as estimates with confidence scores.

## Correct / Wrong / Missing

### Correct

- Remote task endpoint coverage.
- GPRS task endpoint coverage.
- Remote task frontend pages.
- High-risk remote operation validation.
- Meter-level daily/interval data access.
- Site and customer-level consumption analysis foundation.

### Wrong Or Misleading

- Treating site-consumption yearly/monthly output as full-period truth when the source window is only recent.
- Treating appliance-level consumption as available from current AMR API data.
- Wallet remote purchase delivery pretending to complete upstream remote-send while still simulated.

### Missing

- Combined GPRS + Remote monitors for reading, setting, and control.
- Real wallet remote-send integration.
- True weekly/monthly/yearly/overall normalized meter fact API.
- Full historical backfill for consumption.
- Appliance-level telemetry model.
- Lifecycle verification tests for GPRS create/get/update flows.

## Bottom Line

For remote operations and task operations, the project has the right skeleton and many good safety controls. The biggest immediate improvement is to make GPRS and remote task monitoring unified and prove task lifecycle behavior with known meters.

For consumption, the project can provide useful meter/customer/site analytics, but it is currently not enough to guarantee exact day/week/month/year/overall consumption for every user unless the data is normalized and backfilled. It also cannot provide exact appliance-level usage without new telemetry beyond the AMR meter API.
