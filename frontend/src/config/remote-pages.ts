import type { AppPageConfig, DataPageConfig } from "../types/index.ts";
import {
  controlTaskFields,
  createReadOnlyTaskPage,
  createRemoteOperationPage,
  field,
  genericTaskColumns,
  meterControlTaskColumns,
  meterReadingTaskColumns,
  meterTokenTaskColumns,
  readingTaskFields,
  remoteTaskFilters,
  settingTaskFields,
  tokenTaskFields,
  transparentForwardingFields,
  updateFirmwareTaskColumns,
  updateFirmwareTaskFields,
} from "./page-catalog-shared.ts";

function withPageOverrides(page: DataPageConfig, overrides: Partial<DataPageConfig>): AppPageConfig {
  return {
    ...page,
    ...overrides,
  };
}

export const remotePages: AppPageConfig[] = [
  withPageOverrides(
    createRemoteOperationPage(
      "/remote-operation/meter-reading",
      "Meter Reading",
      "Meter Reading",
      "/API/RemoteMeterTask/CreateReadingTask",
      {
        remoteTaskType: "reading",
        payloadBuilderKey: "reading",
        fields: readingTaskFields,
        dangerLevel: "low",
        successRedirectPath: "/remote-operation-task/meter-reading-task",
      },
    ),
    { aliasPaths: ["/remote-operation/remote-meter-reading"] },
  ),
  withPageOverrides(
    createRemoteOperationPage(
      "/remote-operation/meter-setting",
      "Meter Setting",
      "Meter Setting",
      "/API/RemoteMeterTask/CreateSettingTask",
      {
        remoteTaskType: "setting",
        payloadBuilderKey: "setting",
        fields: settingTaskFields,
        dangerLevel: "medium",
        requiresReviewStep: true,
        confirmMessage: "Review this meter setting command before sending it upstream.",
        successRedirectPath: "/remote-operation-task/meter-setting-task",
      },
    ),
    { aliasPaths: ["/remote-operation/remote-meter-setting"] },
  ),
  withPageOverrides(
    createRemoteOperationPage(
      "/remote-operation/meter-control",
      "Meter Control",
      "Meter Control",
      "/API/RemoteMeterTask/CreateControlTask",
      {
        remoteTaskType: "control",
        payloadBuilderKey: "control",
        fields: controlTaskFields,
        dangerLevel: "high",
        requiresReviewStep: true,
        confirmMessage: "This command can change live meter state. Confirm the target and action before submit.",
        successRedirectPath: "/remote-operation-task/meter-control-task",
      },
    ),
    { aliasPaths: ["/remote-operation/remote-meter-control"] },
  ),
  withPageOverrides(
    createRemoteOperationPage(
      "/remote-operation/meter-token",
      "Meter Token",
      "Meter Token",
      "/api/token/remote-send",
      {
        remoteTaskType: "token",
        payloadBuilderKey: "token",
        fields: tokenTaskFields,
        dangerLevel: "high",
        requiresReviewStep: true,
        confirmMessage: "This command sends a remote token operation. Confirm the target and token type before submit.",
        successRedirectPath: "/remote-operation-task/meter-token-task",
      },
    ),
    { aliasPaths: ["/remote-operation/remote-meter-token"] },
  ),
  createRemoteOperationPage(
    "/remote-operation/transparent-forwarding",
    "Transparent Forwarding",
    "Transparent Forwarding",
    "/API/RemoteMeterTask/CreateTransparentForwardingTask",
    {
      remoteTaskType: "transparent-forwarding",
      payloadBuilderKey: "transparent-forwarding",
      fields: transparentForwardingFields,
      dangerLevel: "high",
      requiresReviewStep: true,
      confirmMessage: "Transparent forwarding sends a raw meter command. Confirm the payload and target carefully before submit.",
      successRedirectPath: "/remote-operation-task/transparent-forwarding-task",
    },
  ),
  withPageOverrides(
    createRemoteOperationPage(
      "/remote-operation-gprs/remote-meter-reading",
      "Remote GPRS Meter Reading",
      "Meter Reading",
      "/API/GPRSMeterTask/GPRSCreateReadingTask",
      {
        remoteTaskType: "reading",
        payloadBuilderKey: "reading",
        fields: readingTaskFields,
        dangerLevel: "low",
        successRedirectPath: "/remote-operation-record-gprs/remote-meter-reading-task",
      },
    ),
    { sectionKey: "remote-operation-gprs" },
  ),
  withPageOverrides(
    createRemoteOperationPage(
      "/remote-operation-gprs/remote-meter-setting",
      "Remote GPRS Meter Setting",
      "Meter Setting",
      "/API/GPRSMeterTask/GPRSCreateSettingTask",
      {
        remoteTaskType: "setting",
        payloadBuilderKey: "setting",
        fields: settingTaskFields,
        dangerLevel: "medium",
        requiresReviewStep: true,
        confirmMessage: "Review this GPRS meter setting command before sending it upstream.",
        successRedirectPath: "/remote-operation-record-gprs/remote-meter-setting-task",
      },
    ),
    { sectionKey: "remote-operation-gprs" },
  ),
  withPageOverrides(
    createRemoteOperationPage(
      "/remote-operation-gprs/remote-meter-control",
      "Remote GPRS Meter Control",
      "Meter Control",
      "/API/GPRSMeterTask/GPRSCreateControlTask",
      {
        remoteTaskType: "control",
        payloadBuilderKey: "control",
        fields: controlTaskFields,
        dangerLevel: "high",
        requiresReviewStep: true,
        confirmMessage: "This GPRS command can change live meter state. Confirm the target and action before submit.",
        successRedirectPath: "/remote-operation-record-gprs/remote-meter-control-task",
      },
    ),
    { sectionKey: "remote-operation-gprs" },
  ),
  withPageOverrides(
    createRemoteOperationPage(
      "/remote-operation-gprs/remote-meter-token",
      "Remote GPRS Meter Token",
      "Meter Token",
      "/api/token/remote-send",
      {
        remoteTaskType: "token",
        payloadBuilderKey: "token",
        fields: tokenTaskFields,
        dangerLevel: "high",
        requiresReviewStep: true,
        confirmMessage: "This command sends a remote token operation over the GPRS route when the target meter supports it.",
        successRedirectPath: "/remote-operation-record-gprs/remote-meter-token-task",
      },
    ),
    { sectionKey: "remote-operation-gprs" },
  ),
  {
    kind: "data",
    path: "/remote-operation/update-firmware",
    title: "Update Firmware",
    menuLabel: "Update Firmware",
    description: "Create firmware deployment tasks for remote meters.",
    sectionKey: "remote-operation",
    readEndpoint: "/api/meter/read",
    readOperationKind: "table-read",
    filters: [remoteTaskFilters[0]],
    columns: meterReadingTaskColumns,
    toolbarActions: [
      {
        key: "create-update-firmware-task",
        label: "Create Firmware Task",
        endpoint: "/API/UpdateFirmwareTask/CreateUpdateFirmwareTask",
        tone: "danger",
        operationKind: "task-create",
        fields: updateFirmwareTaskFields,
        requiresReviewStep: true,
        confirmMessage: "Firmware deployment can interrupt live connectivity. Confirm the target and package details before submit.",
        successRedirectPath: "/remote-operation-task/update-firmware-task",
      },
    ],
    live: { enabled: true, intervalMs: 12_000, pauseOnHidden: true },
  },
  withPageOverrides(
    createReadOnlyTaskPage(
      "/remote-operation-task/meter-reading-task",
      "Meter Reading Task",
      "Meter Reading Task",
      "/API/RemoteMeterTask/GetReadingTask",
      {
        columns: meterReadingTaskColumns,
        filters: remoteTaskFilters,
        rowActions: [
          {
            key: "retry-reading",
            label: "Retry",
            endpoint: "/API/RemoteMeterTask/UpdateReadingTask",
            operationKind: "task-update",
            tone: "primary",
            fields: [field("remark", "Remark", "Optional retry note")],
            confirmMessage: "Retry this reading task?",
          },
        ],
      },
    ),
    { aliasPaths: ["/remote-operation-record/remote-meter-reading-task"] },
  ),
  withPageOverrides(
    createReadOnlyTaskPage(
      "/remote-operation-task/meter-setting-task",
      "Meter Setting Task",
      "Meter Setting Task",
      "/API/RemoteMeterTask/GetSettingTask",
      {
        columns: genericTaskColumns,
        filters: remoteTaskFilters,
        rowActions: [
          {
            key: "retry-setting",
            label: "Retry",
            endpoint: "/API/RemoteMeterTask/UpdateSettingTask",
            operationKind: "task-update",
            tone: "primary",
            fields: [field("remark", "Remark", "Optional retry note")],
            confirmMessage: "Retry this setting task?",
          },
        ],
      },
    ),
    { aliasPaths: ["/remote-operation-record/remote-meter-setting-task"] },
  ),
  withPageOverrides(
    createReadOnlyTaskPage(
      "/remote-operation-task/meter-control-task",
      "Meter Control Task",
      "Meter Control Task",
      "/API/RemoteMeterTask/GetControlTask",
      {
        columns: meterControlTaskColumns,
        filters: remoteTaskFilters,
        rowActions: [
          {
            key: "retry-control",
            label: "Retry",
            endpoint: "/API/RemoteMeterTask/UpdateControlTask",
            operationKind: "task-update",
            tone: "danger",
            fields: [field("remark", "Remark", "Optional retry note")],
            confirmMessage: "Retry this control task?",
          },
        ],
      },
    ),
    { aliasPaths: ["/remote-operation-record/remote-meter-control-task"] },
  ),
  withPageOverrides(
    createReadOnlyTaskPage(
      "/remote-operation-task/meter-token-task",
      "Meter Token Task",
      "Meter Token Task",
      "/api/token/remote-task/read",
      {
        columns: meterTokenTaskColumns,
        filters: remoteTaskFilters,
        rowActions: [
          {
            key: "retry-token",
            label: "Retry",
            endpoint: "/api/token/remote-task/update",
            operationKind: "task-update",
            tone: "danger",
            fields: [field("remark", "Remark", "Optional retry note")],
            confirmMessage: "Retry this token task?",
          },
        ],
      },
    ),
    { aliasPaths: ["/remote-operation-record/remote-meter-token-task"] },
  ),
  withPageOverrides(
    createReadOnlyTaskPage(
      "/remote-operation-task/transparent-forwarding-task",
      "Transparent Forwarding Task",
      "Transparent Forwarding Task",
      "/API/RemoteMeterTask/GetTransparentForwardingTask",
      { columns: genericTaskColumns, filters: remoteTaskFilters },
    ),
    { aliasPaths: ["/remote-operation-record/transparent-forwarding-task"] },
  ),
  withPageOverrides(
    createReadOnlyTaskPage(
      "/remote-operation-record-gprs/remote-meter-reading-task",
      "Remote GPRS Meter Reading Task",
      "Meter Reading Task",
      "/API/GPRSMeterTask/GPRSGetReadingTask",
      {
        columns: meterReadingTaskColumns,
        filters: remoteTaskFilters,
        rowActions: [
          {
            key: "retry-gprs-reading",
            label: "Retry",
            endpoint: "/API/GPRSMeterTask/GPRSUpdateReadingTask",
            operationKind: "task-update",
            tone: "primary",
            fields: [field("remark", "Remark", "Optional retry note")],
            confirmMessage: "Retry this GPRS reading task?",
          },
        ],
      },
    ),
    { sectionKey: "remote-operation-task-gprs" },
  ),
  withPageOverrides(
    createReadOnlyTaskPage(
      "/remote-operation-record-gprs/remote-meter-setting-task",
      "Remote GPRS Meter Setting Task",
      "Meter Setting Task",
      "/API/GPRSMeterTask/GPRSGetSettingTask",
      {
        columns: genericTaskColumns,
        filters: remoteTaskFilters,
        rowActions: [
          {
            key: "retry-gprs-setting",
            label: "Retry",
            endpoint: "/API/GPRSMeterTask/GPRSUpdateSettingTask",
            operationKind: "task-update",
            tone: "primary",
            fields: [field("remark", "Remark", "Optional retry note")],
            confirmMessage: "Retry this GPRS setting task?",
          },
        ],
      },
    ),
    { sectionKey: "remote-operation-task-gprs" },
  ),
  withPageOverrides(
    createReadOnlyTaskPage(
      "/remote-operation-record-gprs/remote-meter-control-task",
      "Remote GPRS Meter Control Task",
      "Meter Control Task",
      "/API/GPRSMeterTask/GPRSGetControlTask",
      {
        columns: meterControlTaskColumns,
        filters: remoteTaskFilters,
        rowActions: [
          {
            key: "retry-gprs-control",
            label: "Retry",
            endpoint: "/API/GPRSMeterTask/GPRSUpdateControlTask",
            operationKind: "task-update",
            tone: "danger",
            fields: [field("remark", "Remark", "Optional retry note")],
            confirmMessage: "Retry this GPRS control task?",
          },
        ],
      },
    ),
    { sectionKey: "remote-operation-task-gprs" },
  ),
  withPageOverrides(
    createReadOnlyTaskPage(
      "/remote-operation-record-gprs/remote-meter-token-task",
      "Remote GPRS Meter Token Task",
      "Meter Token Task",
      "/API/GPRSMeterTask/GPRSGetTokenTask",
      {
        columns: meterTokenTaskColumns,
        filters: remoteTaskFilters,
        rowActions: [
          {
            key: "retry-gprs-token",
            label: "Retry",
            endpoint: "/API/GPRSMeterTask/GPRSUpdateTokenTask",
            operationKind: "task-update",
            tone: "danger",
            fields: [field("remark", "Remark", "Optional retry note")],
            confirmMessage: "Retry this GPRS token task?",
          },
        ],
      },
    ),
    { sectionKey: "remote-operation-task-gprs" },
  ),
  withPageOverrides(
    createReadOnlyTaskPage(
      "/remote-operation-task/update-firmware-task",
      "Update Firmware Task",
      "Update Firmware Task",
      "/API/UpdateFirmwareTask/GetUpdateFirmwareTask",
      {
        columns: updateFirmwareTaskColumns,
        filters: remoteTaskFilters,
      },
    ),
    { aliasPaths: ["/remote-operation-record/update-firmware-task"] },
  ),
];
