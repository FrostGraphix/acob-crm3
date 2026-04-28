# AMR API Reference

Source:
- Swagger UI: http://8.208.16.168:9310/index.html
- OpenAPI spec: http://8.208.16.168:9310/swagger/v1/swagger.json

This document is a working reference derived from the live OpenAPI document exposed by the AMR API. It is meant to make the API easier to navigate than the raw Swagger page.

## Overview

- API title: `AMR API`
- Version: `v1`
- OpenAPI version: `3.0.1`
- Total documented endpoints: `144`
- Main security scheme: `Bearer` token in the `Authorization` header

## How The API Operates

The API is mostly organized by business module. Most modules follow a repeatable pattern:

- `read`: query a paginated or filtered dataset
- `create`: create one or more records
- `update`: update one or more records
- `delete`: delete one or more records
- `import`: bulk insert or bulk sync records

The important implementation detail is that many write endpoints accept arrays, even when you are only creating or updating a single record. In practice, that means you often send:

```json
[
  {
    "someField": "value"
  }
]
```

rather than:

```json
{
  "someField": "value"
}
```

### Response Pattern

Most endpoints return an application-level envelope:

```json
{
  "code": 0,
  "reason": "success",
  "result": {}
}
```

Observed live behavior:
- HTTP status often stays `200` even when the business action fails
- Success or failure is communicated by the `code` and `reason` fields

Live examples observed from the running API:

Invalid login:

```json
{
  "code": 1,
  "reason": "invalid username or password",
  "result": null
}
```

Account read with an insufficient or invalid query:

```json
{
  "code": 99,
  "reason": "Query failed, please try again",
  "result": null
}
```

### Authentication

The spec defines:

- header name: `Authorization`
- scheme style: `Bearer <jwt-token>`

Typical flow:

1. Call `/api/user/login`
2. Read `result.token`
3. Send `Authorization: Bearer <token>` on subsequent requests

Example:

```http
Authorization: Bearer eyJhbGciOi...
```

## Quick Start Examples

These examples are based on the schema definitions in the OpenAPI spec. Where the spec does not provide exact examples, the payloads below are inferred from the request schema.

### 1. Login

Endpoint:
- `POST /api/user/login`

Request:

```json
{
  "userId": "admin",
  "password": "your-password"
}
```

Expected response shape:

```json
{
  "code": 0,
  "reason": "success",
  "result": {
    "token": "jwt-token-here"
  }
}
```

### 2. Read Accounts

Endpoint:
- `POST /api/account/read`

Example request:

```json
{
  "customerId": "CUS-001",
  "customerName": "ACME Power",
  "meterId": "MTR-1001",
  "stationId": "ST-01",
  "pageNumber": 1,
  "pageSize": 20,
  "orderBy": "createDate desc"
}
```

How it appears to work:
- filter accounts by customer, meter, protocol, tariff, station, text search, and date ranges
- supports pagination with `pageNumber` and `pageSize`
- returns an object response rather than a plain array, so `result` likely contains paging metadata plus data rows

Response envelope shape:

```json
{
  "code": 0,
  "reason": "success",
  "result": {
    "total": 0,
    "data": []
  }
}
```

### 3. Create Or Import Accounts

Endpoints:
- `POST /api/account/create`
- `POST /api/account/import`

Example request:

```json
[
  {
    "customerId": "CUS-001",
    "meterId": "MTR-1001",
    "tariffId": "TAR-01",
    "ctRatio": "200/5",
    "remark": "Primary feeder account",
    "stationId": "ST-01"
  }
]
```

Notes:
- `customerId` and `meterId` are required
- `import` appears to be a bulk variation of `create`

### 4. Update Accounts

Endpoint:
- `POST /api/account/update`

Example request:

```json
[
  {
    "customerId": "CUS-001",
    "meterId": "MTR-1001",
    "oldMeterId": "MTR-0999",
    "tariffId": "TAR-02",
    "ctRatio": "300/5",
    "remark": "Meter replaced",
    "stationId": "ST-01"
  }
]
```

How it appears to work:
- same base schema as create
- `oldMeterId` suggests the meter identifier itself may be mutable during an update

### 5. Delete Accounts

Endpoint:
- `POST /api/account/delete`

Example request:

```json
[
  {
    "customerId": "CUS-001",
    "meterId": "MTR-1001"
  }
]
```

### 6. Read Meters

Endpoint:
- `POST /api/meter/read`

Example request:

```json
{
  "meterId": "MTR-1001",
  "customerId": "CUS-001",
  "stationId": "ST-01",
  "pageNumber": 1,
  "pageSize": 20
}
```

How it appears to work:
- used for searching or listing meters
- the companion `addread` endpoint appears to be a specialized meter read variant using the same request schema

### 7. Generate A Credit Token

Endpoint:
- `POST /api/token/creditToken/generate`

Example request:

```json
{
  "meterId": "MTR-1001",
  "isPreview": false,
  "isVendByTotalPaid": true,
  "amount": 5000,
  "payDebtPercent": 10,
  "authorizationPassword": "123456",
  "isS2": false
}
```

How it appears to work:
- generates a prepaid credit token for a meter
- supports preview mode
- supports debt settlement percentage
- likely requires elevated user authorization for sensitive token actions

### 8. Create A Remote Meter Task

Endpoint:
- `POST /API/RemoteMeterTask/CreateReadingTask`

Example request:

```json
[
  {
    "customerId": "CUS-001",
    "meterId": "MTR-1001",
    "version": "DLT645-2007",
    "flag": "READ_TOTAL_ENERGY",
    "dataDefault": "",
    "data": "",
    "stationId": "ST-01"
  }
]
```

How it appears to work:
- creates a task to be executed later against a remote meter
- the companion `Get...Task` and `Update...Task` endpoints are used to inspect and manage task lifecycle

### 9. Create A GPRS Meter Task

Endpoint:
- `POST /API/GPRSMeterTask/GPRSCreateReadingTask`

Example request:

```json
[
  {
    "customerId": "CUS-001",
    "meterId": "MTR-1001",
    "protocolId": 1,
    "data": "",
    "stationId": "ST-01"
  }
]
```

How it appears to work:
- similar to the remote meter task family
- appears to target GPRS-connected meters using protocol-driven operations

### 10. Upload A File

Endpoints:
- `POST /API/File/Upload`
- `POST /API/File/UploadBin`
- `POST /API/File/ConcentratorUploadBin`

How it appears to work:
- the Swagger path list shows these endpoints but does not expose a JSON request schema
- they are likely multipart or binary upload endpoints
- the response type is `StringResponseDto`, so they probably return a status message, file name, or storage path

## Common DTO Patterns

### Read Request Pattern

Many `read` schemas use these fields:

- domain filters such as `customerId`, `meterId`, `stationId`, `status`, `remark`
- `searchTerm`
- `createDateRange`
- `updateDateRange`
- `pageNumber`
- `pageSize`
- `orderBy`

This means most read endpoints act like server-side grid queries.

### Write Request Pattern

Many `create`, `update`, and `import` schemas:

- are arrays of objects
- contain a few required identity fields
- accept optional `remark` and `stationId`

### Task Pattern

Task modules tend to follow:

- `Create...Task`
- `Get...Task`
- `Update...Task`

This suggests the backend models remote operations as queued jobs rather than immediate synchronous meter actions.

### Token Pattern

Token APIs usually split into:

- `.../generate`
- `...Record/read`
- sometimes `...Record/cancel`

This suggests token issuance is recorded as an auditable business transaction.

## Full Endpoint Catalog

Each line below lists:

- endpoint path
- operation id from Swagger
- request schema
- response schema

## Account
- `/api/account/create` (`CreateAccount`)
  request: `Array<AccountRequest>`
  response: `AccountInfoResponseListResponseDto`
- `/api/account/delete` (`DeleteAccount`)
  request: `Array<AccountDeleteRequest>`
  response: `AccountInfoResponseListResponseDto`
- `/api/account/import` (`ImportAccount`)
  request: `Array<AccountRequest>`
  response: `AccountInfoResponseListResponseDto`
- `/api/account/read` (`ReadAccount`)
  request: `AccountReadRequest`
  response: `AccountResponseResponseDto`
- `/api/account/update` (`UpdateAccount`)
  request: `Array<AccountRequest>`
  response: `AccountInfoResponseListResponseDto`

## Customer
- `/api/customer/create` (`CreateCustomer`)
  request: `Array<CustomerRequest>`
  response: `CustomerInfoResponseListResponseDto`
- `/api/customer/delete` (`DeleteCustomer`)
  request: `Array<CustomerDeleteRequest>`
  response: `CustomerInfoResponseListResponseDto`
- `/api/customer/import` (`ImportCustomer`)
  request: `Array<CustomerRequest>`
  response: `CustomerInfoResponseListResponseDto`
- `/api/customer/read` (`ReadCustomer`)
  request: `CustomerReadRequest`
  response: `CustomerResponseResponseDto`
- `/api/customer/update` (`UpdateCustomer`)
  request: `Array<CustomerRequest>`
  response: `CustomerInfoResponseListResponseDto`

## DailyData
- `/api/DailyData/read` (`ReadDailyData`)
  request: `DailyDataReadRequest`
  response: `DailyDataResponseResponseDto`
- `/api/DailyData/readMonthly` (`ReadDailyDataMonthly`)
  request: `DailyDataReadRequest`
  response: `DailyDataResponseResponseDto`
- `/api/DailyData/readMore` (`ReadDailyDataMore`)
  request: `DailyDataReadRequest`
  response: `DailyDataResponseResponseDto`

## DailyDataMeter
- `/api/DailyDataMeter/read` (`ReadDailyDataMeter`)
  request: `DailyDataMeterReadRequest`
  response: `DailyDataMeterResponseResponseDto`
- `/api/DailyDataMeter/readMonthly` (`ReadDailyDataMeterMonthly`)
  request: `DailyDataMeterReadRequest`
  response: `DailyDataMeterResponseResponseDto`
- `/api/DailyDataMeter/readMore` (`ReadDailyDataMoreMeter`)
  request: `DailyDataMeterReadRequest`
  response: `DailyDataMeterResponseResponseDto`

## Dashboard
- `/api/dashboard/readLineChart` (`ReadLineChart`)
  request: `LineChartRequest`
  response: `LineChartResponseResponseDto`
- `/api/dashboard/readPanelGroup` (`ReadPanelGroup`)
  request: `None/Other`
  response: `PanelGroupResponseResponseDto`

## Debt
- `/api/debt/create` (`CreateDebt`)
  request: `Array<DebtRequest>`
  response: `DebtInfoResponseListResponseDto`
- `/api/debt/delete` (`DeleteDebt`)
  request: `Array<DebtDeleteRequest>`
  response: `DebtInfoResponseListResponseDto`
- `/api/debt/import` (`ImportDebt`)
  request: `Array<DebtRequest>`
  response: `DebtInfoResponseListResponseDto`
- `/api/debt/read` (`ReadDebt`)
  request: `DebtReadRequest`
  response: `DebtResponseResponseDto`
- `/api/debt/update` (`UpdateDebt`)
  request: `Array<DebtRequest>`
  response: `DebtInfoResponseListResponseDto`

## DLMS
- `/api/dlms/Create` (`CreateDLMS`)
  request: `Array<DLMSRequest>`
  response: `DLMSInfoResponseListResponseDto`
- `/api/dlms/Delete` (`DeleteDLMS`)
  request: `Array<DLMSDeleteRequest>`
  response: `DLMSInfoResponseListResponseDto`
- `/api/dlms/Import` (`ImportDLMS`)
  request: `Array<DLMSRequest>`
  response: `DLMSInfoResponseListResponseDto`
- `/api/dlms/Read` (`ReadDLMS`)
  request: `DLMSReadRequest`
  response: `DLMSResponseResponseDto`
- `/api/dlms/ReadDLMSTree` (`ReadDLMSTree`)
  request: `DLMSTreeRequest`
  response: `DLMSTreeResponseListResponseDto`
- `/api/dlms/Update` (`UpdateDLMS`)
  request: `Array<DLMSRequest>`
  response: `DLMSInfoResponseListResponseDto`

## DLT645
- `/api/dlt645/create` (`CreateDLT645`)
  request: `Array<DLT645Request>`
  response: `DLT645InfoResponseListResponseDto`
- `/api/dlt645/delete` (`DeleteDLT645`)
  request: `Array<DLT645DeleteRequest>`
  response: `DLT645InfoResponseListResponseDto`
- `/api/dlt645/import` (`ImportDLT645`)
  request: `Array<DLT645Request>`
  response: `DLT645InfoResponseListResponseDto`
- `/api/dlt645/read` (`ReadDLT645`)
  request: `DLT645ReadRequest`
  response: `DLT645ResponseResponseDto`
- `/api/dlt645/readDLT645Tree` (`ReadDLT645Tree`)
  request: `DLT645TreeRequest`
  response: `DLT645TreeResponseListResponseDto`
- `/api/dlt645/update` (`UpdateDLT645`)
  request: `Array<DLT645Request>`
  response: `DLT645InfoResponseListResponseDto`

## DLT645Task
- `/api/DLT645Task/read` (`ReadDLT645Task`)
  request: `DLT645TaskReadRequest`
  response: `DLT645TaskResponseResponseDto`

## EventNotification
- `/API/EventNotification/Read` (`ReadEventNotification`)
  request: `EventNotificationReadRequest`
  response: `EventNotificationResponseResponseDto`

## File
- `/API/File/ConcentratorUploadBin` (`FileConcentratorUploadBin`)
  request: `None/Other`
  response: `StringResponseDto`
- `/API/File/Upload` (`FileUpload`)
  request: `None/Other`
  response: `StringResponseDto`
- `/API/File/UploadBin` (`FileUploadBin`)
  request: `None/Other`
  response: `StringResponseDto`

## Gateway
- `/api/gateway/create` (`CreateGateway`)
  request: `Array<GatewayWriteRequest>`
  response: `GatewayInfoResponseListResponseDto`
- `/api/gateway/delete` (`DeleteGateway`)
  request: `Array<GatewayDeleteRequest>`
  response: `GatewayInfoResponseListResponseDto`
- `/api/gateway/import` (`ImportGateway`)
  request: `Array<GatewayWriteRequest>`
  response: `GatewayInfoResponseListResponseDto`
- `/api/gateway/read` (`ReadGateway`)
  request: `GatewayReadRequest`
  response: `GatewayResponseResponseDto`
- `/api/gateway/update` (`UpdateGateway`)
  request: `Array<GatewayWriteRequest>`
  response: `GatewayInfoResponseListResponseDto`

## GPRSMeterTask
- `/API/GPRSMeterTask/GPRSCreateControlTask` (`GPRSCreateControlTask`)
  request: `Array<ProtocolTaskRequest>`
  response: `ProtocolTaskInfoResponseListResponseDto`
- `/API/GPRSMeterTask/GPRSCreateReadingTask` (`GPRSCreateReadingTask`)
  request: `Array<ProtocolTaskRequest>`
  response: `ProtocolTaskInfoResponseListResponseDto`
- `/API/GPRSMeterTask/GPRSCreateSettingTask` (`GPRSCreateSettingTask`)
  request: `Array<ProtocolTaskRequest>`
  response: `ProtocolTaskInfoResponseListResponseDto`
- `/API/GPRSMeterTask/GPRSCreateTokenTask` (`GPRSCreateTokenTask`)
  request: `Array<ProtocolTaskRequest>`
  response: `ProtocolTaskInfoResponseListResponseDto`
- `/API/GPRSMeterTask/GPRSGetControlTask` (`GPRSGetControlTask`)
  request: `ProtocolTaskReadRequest`
  response: `ProtocolTaskResponseResponseDto`
- `/API/GPRSMeterTask/GPRSGetReadingTask` (`GPRSGetReadingTask`)
  request: `ProtocolTaskReadRequest`
  response: `ProtocolTaskResponseResponseDto`
- `/API/GPRSMeterTask/GPRSGetSettingTask` (`GPRSGetSettingTask`)
  request: `ProtocolTaskReadRequest`
  response: `ProtocolTaskResponseResponseDto`
- `/API/GPRSMeterTask/GPRSGetTokenTask` (`GPRSGetTokenTask`)
  request: `ProtocolTaskReadRequest`
  response: `ProtocolTaskResponseResponseDto`
- `/API/GPRSMeterTask/GPRSUpdateControlTask` (`GPRSUpdateControlTask`)
  request: `Array<ProtocolTaskUpdateRequest>`
  response: `ProtocolTaskInfoResponseListResponseDto`
- `/API/GPRSMeterTask/GPRSUpdateReadingTask` (`GPRSUpdateReadingTask`)
  request: `Array<ProtocolTaskUpdateRequest>`
  response: `ProtocolTaskInfoResponseListResponseDto`
- `/API/GPRSMeterTask/GPRSUpdateSettingTask` (`GPRSUpdateSettingTask`)
  request: `Array<ProtocolTaskUpdateRequest>`
  response: `ProtocolTaskInfoResponseListResponseDto`
- `/API/GPRSMeterTask/GPRSUpdateTokenTask` (`GPRSUpdateTokenTask`)
  request: `Array<ProtocolTaskUpdateRequest>`
  response: `ProtocolTaskInfoResponseListResponseDto`

## GPRSOnlineStatus
- `/API/GPRSOnlineStatus/Read` (`ReadGPRSOnlineStatus`)
  request: `GPRSOnlineStatusReadRequest`
  response: `GPRSOnlineStatusResponseResponseDto`
- `/API/GPRSOnlineStatus/Update` (`UpdateGPRSOnlineStatus`)
  request: `Array<GPRSOnlineStatusRequest>`
  response: `GPRSOnlineStatusInfoResponseListResponseDto`
- `/API/GPRSOnlineStatus/View` (`ViewGPRSOnlineStatus`)
  request: `GPRSOnlineStatusDetailsRequest`
  response: `GPRSOnlineStatusInfoResponseListResponseDto`

## Item
- `/api/item/create` (`CreateItem`)
  request: `Array<ItemRequest>`
  response: `ItemInfoResponseListResponseDto`
- `/api/item/delete` (`DeleteItem`)
  request: `Array<ItemDeleteRequest>`
  response: `ItemInfoResponseListResponseDto`
- `/api/item/import` (`ImportItem`)
  request: `Array<ItemRequest>`
  response: `ItemInfoResponseListResponseDto`
- `/api/item/read` (`ReadItem`)
  request: `ItemReadRequest`
  response: `ItemResponseResponseDto`
- `/api/item/readItemList` (`ReadItemList`)
  request: `ItemListRequest`
  response: `ItemListResponseListResponseDto`
- `/api/item/update` (`UpdateItem`)
  request: `Array<ItemRequest>`
  response: `ItemInfoResponseListResponseDto`

## LoadProfile
- `/API/LoadProfile/DailyData` (`ReadLoadProfileDailyData`)
  request: `LoadProfileDailyDataReadRequest`
  response: `LoadProfileDailyDataResponseResponseDto`
- `/API/LoadProfile/ElectricEnergyCurve` (`ReadLoadProfile`)
  request: `LoadProfileReadRequest`
  response: `LoadProfileResponseResponseDto`
- `/API/LoadProfile/InstantaneousValueCurve` (`ReadLoadProfileInstantaneousValue`)
  request: `LoadProfileInstantaneousValueReadRequest`
  response: `LoadProfileInstantaneousValueResponseResponseDto`
- `/API/LoadProfile/MonthlyData` (`ReadLoadProfileMonthlyData`)
  request: `LoadProfileMonthlyDataReadRequest`
  response: `LoadProfileMonthlyDataResponseResponseDto`

## Log
- `/api/Log/read` (`ReadLog`)
  request: `LogReadRequest`
  response: `LogResponseResponseDto`

## Meter
- `/api/meter/addread` (`AddReadMeter`)
  request: `MeterReadRequest`
  response: `MeterResponse2ResponseDto`
- `/api/meter/create` (`CreateMeter`)
  request: `Array<MeterWriteRequest>`
  response: `MeterInfoResponseListResponseDto`
- `/api/meter/delete` (`DeleteMeter`)
  request: `Array<MeterDeleteRequest>`
  response: `MeterInfoResponseListResponseDto`
- `/api/meter/import` (`ImportMeter`)
  request: `Array<MeterWriteRequest>`
  response: `MeterInfoResponseListResponseDto`
- `/api/meter/read` (`ReadMeter`)
  request: `MeterReadRequest`
  response: `MeterResponse2ResponseDto`
- `/api/meter/update` (`UpdateMeter`)
  request: `Array<MeterWriteRequest>`
  response: `MeterInfoResponseListResponseDto`

## PrepayReport
- `/API/PrepayReport/ConsumptionStatistics` (`ConsumptionStatistics`)
  request: `ConsumptionStatisticsReadRequest`
  response: `ConsumptionStatisticsResponseResponseDto`
- `/API/PrepayReport/LongNonpurchaseSituation` (`LongNonpurchaseSituation`)
  request: `LongNonpurchaseSituationReadRequest`
  response: `LongNonpurchaseSituationResponseResponseDto`
- `/API/PrepayReport/LowPurchaseSituation` (`LowPurchaseSituation`)
  request: `LowPurchaseSituationReadRequest`
  response: `LowPurchaseSituationResponseResponseDto`

## RemoteMeterTask
- `/API/RemoteMeterTask/CreateControlTask` (`CreateControlTask`)
  request: `Array<DLT645TaskRequest>`
  response: `DLT645TaskInfoResponseListResponseDto`
- `/API/RemoteMeterTask/CreateReadingTask` (`CreateReadingTask`)
  request: `Array<DLT645TaskRequest>`
  response: `DLT645TaskInfoResponseListResponseDto`
- `/API/RemoteMeterTask/CreateSettingTask` (`CreateSettingTask`)
  request: `Array<DLT645TaskRequest>`
  response: `DLT645TaskInfoResponseListResponseDto`
- `/API/RemoteMeterTask/CreateTokenTask` (`CreateTokenTask`)
  request: `Array<DLT645TaskRequest>`
  response: `DLT645TaskInfoResponseListResponseDto`
- `/API/RemoteMeterTask/CreateTransparentForwardingTask` (`CreateTransparentForwardingTask`)
  request: `Array<DLT645TFTaskRequest>`
  response: `DLT645TaskInfoResponseListResponseDto`
- `/API/RemoteMeterTask/GetControlTask` (`GetControlTask`)
  request: `DLT645TaskReadRequest`
  response: `DLT645TaskResponseResponseDto`
- `/API/RemoteMeterTask/GetReadingTask` (`GetReadingTask`)
  request: `DLT645TaskReadRequest`
  response: `DLT645TaskResponseResponseDto`
- `/API/RemoteMeterTask/GetSettingTask` (`GetSettingTask`)
  request: `DLT645TaskReadRequest`
  response: `DLT645TaskResponseResponseDto`
- `/API/RemoteMeterTask/GetTokenTask` (`GetTokenTask`)
  request: `DLT645TaskReadRequest`
  response: `DLT645TaskResponseResponseDto`
- `/API/RemoteMeterTask/GetTransparentForwardingTask` (`GetTransparentForwardingTask`)
  request: `DLT645TaskReadRequest`
  response: `DLT645TFTaskResponseResponseDto`
- `/API/RemoteMeterTask/UpdateControlTask` (`UpdateControlTask`)
  request: `Array<DLT645TaskUpdateRequest>`
  response: `DLT645TaskInfoResponseListResponseDto`
- `/API/RemoteMeterTask/UpdateReadingTask` (`UpdateReadingTask`)
  request: `Array<DLT645TaskUpdateRequest>`
  response: `DLT645TaskInfoResponseListResponseDto`
- `/API/RemoteMeterTask/UpdateSettingTask` (`UpdateSettingTask`)
  request: `Array<DLT645TaskUpdateRequest>`
  response: `DLT645TaskInfoResponseListResponseDto`
- `/API/RemoteMeterTask/UpdateTokenTask` (`UpdateTokenTask`)
  request: `Array<DLT645TaskUpdateRequest>`
  response: `DLT645TaskInfoResponseListResponseDto`

## Role
- `/api/role/create` (`CreateRole`)
  request: `Array<RoleCreateRequest>`
  response: `RoleInfoResponseListResponseDto`
- `/api/role/delete` (`DeleteRole`)
  request: `Array<RoleDeleteRequest>`
  response: `RoleInfoResponseListResponseDto`
- `/api/role/import` (`ImportRole`)
  request: `Array<RoleImportRequest>`
  response: `RoleInfoResponseListResponseDto`
- `/api/role/read` (`ReadRole`)
  request: `RoleReadRequest`
  response: `RoleResponseResponseDto`
- `/api/role/ReadDataRole` (`ReadRoleData`)
  request: `RoleReadRequest`
  response: `RoleDataResponseDto`
- `/api/role/update` (`UpdateRole`)
  request: `Array<RoleUpdateRequest>`
  response: `RoleInfoResponseListResponseDto`

## Station
- `/api/station/create` (`CreateStation`)
  request: `Array<StationRequest>`
  response: `StationInfoResponseListResponseDto`
- `/api/station/delete` (`DeleteStation`)
  request: `Array<StationDeleteRequest>`
  response: `StationInfoResponseListResponseDto`
- `/api/station/import` (`ImportStation`)
  request: `Array<StationRequest>`
  response: `StationInfoResponseListResponseDto`
- `/api/station/read` (`ReadStation`)
  request: `StationReadRequest`
  response: `StationResponseResponseDto`
- `/api/station/update` (`UpdateStation`)
  request: `Array<StationRequest>`
  response: `StationInfoResponseListResponseDto`

## Tariff
- `/api/tariff/create` (`CreateTariff`)
  request: `Array<TariffCreateRequest>`
  response: `TariffInfoResponseListResponseDto`
- `/api/tariff/delete` (`DeleteTariff`)
  request: `Array<TariffDeleteRequest>`
  response: `TariffInfoResponseListResponseDto`
- `/api/tariff/import` (`ImportTariff`)
  request: `Array<TariffImportRequest>`
  response: `TariffInfoResponseListResponseDto`
- `/api/tariff/read` (`ReadTariff`)
  request: `TariffReadRequest`
  response: `TariffResponseResponseDto`
- `/api/tariff/update` (`UpdateTariff`)
  request: `Array<TariffUpdateRequest>`
  response: `TariffInfoResponseListResponseDto`

## Token
- `/api/token/changeMeterKeyToken/generate` (`GenerateChangeMeterKeyToken`)
  request: `ChangeMeterKeyTokenRequest`
  response: `ChangeMeterKeyTokenRecordInfoResponseResponseDto`
- `/api/token/changeMeterKeyTokenRecord/read` (`ReadChangeMeterKeyTokenRecord`)
  request: `ChangeMeterKeyTokenRecordReadRequest`
  response: `ChangeMeterKeyTokenRecordResponseResponseDto`
- `/api/token/clearCreditToken/generate` (`GenerateClearCreditToken`)
  request: `ClearCreditTokenRequest`
  response: `ClearCreditTokenRecordInfoResponseResponseDto`
- `/api/token/clearCreditTokenRecord/read` (`ReadClearCreditTokenRecord`)
  request: `ClearCreditTokenRecordReadRequest`
  response: `ClearCreditTokenRecordResponseResponseDto`
- `/api/token/clearTamperToken/generate` (`GenerateClearTamperToken`)
  request: `ClearTamperTokenRequest`
  response: `ClearTamperTokenRecordInfoResponseResponseDto`
- `/api/token/clearTamperTokenRecord/read` (`ReadClearTamperTokenRecord`)
  request: `ClearTamperTokenRecordReadRequest`
  response: `ClearTamperTokenRecordResponseResponseDto`
- `/api/token/creditToken/generate` (`GenerateCreditToken`)
  request: `CreditTokenRequest`
  response: `CreditTokenRecordInfoResponseResponseDto`
- `/api/token/creditTokenCancelRecord/read` (`ReadCreditTokenCancelRecord`)
  request: `CreditTokenRecordReadRequest`
  response: `CreditTokenRecordResponseResponseDto`
- `/api/token/creditTokenRecord/cancel` (`CancelCreditTokenRecord`)
  request: `CreditTokenRecordCancelRequest`
  response: `CreditTokenRecordInfoResponseListResponseDto`
- `/api/token/creditTokenRecord/read` (`ReadCreditTokenRecord`)
  request: `CreditTokenRecordReadRequest`
  response: `CreditTokenRecordResponseResponseDto`
- `/api/token/meterKey/update` (`UpdateMeterKey`)
  request: `Array<UpdateMeterKeyRequest>`
  response: `UpdateMeterKeyResponseListResponseDto`
- `/api/token/meterTestToken/read` (`ReadMeterTestToken`)
  request: `MeterTestReadRequest`
  response: `MeterTestResponseResponseDto`
- `/api/token/setMaximumOverdraftLimitToken/generate` (`GenerateSetMaximumOverdraftLimitToken`)
  request: `SetMaximumOverdraftLimitTokenRequest`
  response: `SetMaximumOverdraftLimitTokenRecordInfoResponseResponseDto`
- `/api/token/setMaximumOverdraftLimitTokenRecord/read` (`ReadSetMaximumOverdraftLimitTokenRecord`)
  request: `SetMaximumOverdraftLimitTokenRecordReadRequest`
  response: `SetMaximumOverdraftLimitTokenRecordResponseResponseDto`
- `/api/token/setMaximumPhasePowerUnbalanceLimitToken/generate` (`GenerateSetMaximumPhasePowerUnbalanceLimitToken`)
  request: `SetMaximumPhasePowerUnbalanceLimitTokenRequest`
  response: `SetMaximumPhasePowerUnbalanceLimitTokenRecordInfoResponseResponseDto`
- `/api/token/setMaximumPhasePowerUnbalanceLimitTokenRecord/read` (`ReadSetMaximumPhasePowerUnbalanceLimitTokenRecord`)
  request: `SetMaximumPhasePowerUnbalanceLimitTokenRecordReadRequest`
  response: `SetMaximumPhasePowerUnbalanceLimitTokenRecordResponseResponseDto`
- `/api/token/setMaximumPowerLimitToken/generate` (`GenerateSetMaximumPowerLimitToken`)
  request: `SetMaximumPowerLimitTokenRequest`
  response: `SetMaximumPowerLimitTokenRecordInfoResponseResponseDto`
- `/api/token/setMaximumPowerLimitTokenRecord/read` (`ReadSetMaximumPowerLimitTokenRecord`)
  request: `SetMaximumPowerLimitTokenRecordReadRequest`
  response: `SetMaximumPowerLimitTokenRecordResponseResponseDto`

## UpdateFirmwareTask
- `/API/UpdateFirmwareTask/CreateUpdateFirmwareTask` (`CreateUpdateFirmwareTask`)
  request: `Array<UpdateFirmwareTaskRequest>`
  response: `UpdateFirmwareTaskInfoResponseListResponseDto`
- `/API/UpdateFirmwareTask/GetUpdateFirmwareTask` (`GetUpdateFirmwareTask`)
  request: `UpdateFirmwareTaskReadRequest`
  response: `UpdateFirmwareTaskResponseResponseDto`

## User
- `/api/user/create` (`CreateUser`)
  request: `Array<UserCreateRequest>`
  response: `UserInfoResponseListResponseDto`
- `/api/user/delete` (`DeleteUser`)
  request: `Array<UserDeleteRequest>`
  response: `UserInfoResponseListResponseDto`
- `/api/user/import` (`ImportUser`)
  request: `Array<UserImportRequest>`
  response: `UserInfoResponseListResponseDto`
- `/api/user/info` (`GetUserLoginInfo`)
  request: `None/Other`
  response: `UserInfoResponseResponseDto`
- `/api/user/login` (`Login`)
  request: `UserLoginRequest`
  response: `UserLoginResponseResponseDto`
- `/api/user/logout` (`Logout`)
  request: `None/Other`
  response: `ObjectResponseDto`
- `/api/user/modifyAuthorizationPassword` (`ModifyAuthorizationPassword`)
  request: `UserPasswordRequest`
  response: `UserInfoResponseListResponseDto`
- `/api/user/modifyLoginPassword` (`ModifyLoginPassword`)
  request: `UserPasswordRequest`
  response: `UserInfoResponseListResponseDto`
- `/api/user/read` (`ReadUser`)
  request: `UserReadRequest`
  response: `UserResponseResponseDto`
- `/api/user/reset` (`ResetPassword`)
  request: `UserResetRequest`
  response: `UserInfoResponseListResponseDto`
- `/api/user/update` (`UpdateUser`)
  request: `Array<UserUpdateRequest>`
  response: `UserInfoResponseListResponseDto`
- `/api/user/updateInfo` (`UpdateUserInfo`)
  request: `UserInfoRequest`
  response: `UserInfoResponseListResponseDto`

## Practical Reading Of The API Surface

If you are integrating this API into another system, the easiest mental model is:

- `User` handles login, current user, password maintenance, and admin user management
- `Account`, `Customer`, `Meter`, `Gateway`, `Station`, `Tariff`, `Debt`, `Role`, and `Item` are master-data modules
- `DailyData`, `DailyDataMeter`, `LoadProfile`, `Dashboard`, `Log`, and `PrepayReport` are reporting and analytics modules
- `DLMS`, `DLT645`, `RemoteMeterTask`, `GPRSMeterTask`, and `UpdateFirmwareTask` are protocol and device-operation modules
- `Token` is the prepaid and meter-key business domain
- `File` covers uploads, likely for firmware, bin files, or imports

## Limitations And Notes

- Swagger exposes schema names but not rich human-written endpoint descriptions
- Many example payloads in this document are inferred from the request schema because the spec does not publish sample values
- The API appears to use HTTP `200` for some business failures, so integrations should always inspect `code` and `reason`
- Some non-JSON endpoints, especially under `File`, likely require multipart or binary payloads that are not fully described in the OpenAPI document
