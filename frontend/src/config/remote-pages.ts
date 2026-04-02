import type { AppPageConfig } from "../types/index.ts";
import {
  createReadOnlyTaskPage,
  createRemoteOperationPage,
  genericTaskColumns,
  meterControlTaskColumns,
  meterReadingTaskColumns,
  meterTokenTaskColumns,
  searchFilter,
} from "./page-catalog-shared.ts";

export const remotePages: AppPageConfig[] = [
  createRemoteOperationPage(
    "/remote-operation/meter-reading",
    "Meter Reading",
    "Meter Reading",
    "/API/RemoteMeterTask/CreateReadingTask",
  ),
  createRemoteOperationPage(
    "/remote-operation/meter-setting",
    "Meter Setting",
    "Meter Setting",
    "/API/RemoteMeterTask/CreateSettingTask",
  ),
  createRemoteOperationPage(
    "/remote-operation/meter-control",
    "Meter Control",
    "Meter Control",
    "/API/RemoteMeterTask/CreateControlTask",
  ),
  createRemoteOperationPage(
    "/remote-operation/meter-token",
    "Meter Token",
    "Meter Token",
    "/API/RemoteMeterTask/CreateTokenTask",
  ),
  createRemoteOperationPage(
    "/remote-operation/transparent-forwarding",
    "Transparent Forwarding",
    "Transparent Forwarding",
    "/API/RemoteMeterTask/CreateTransparentForwardingTask",
  ),
  createReadOnlyTaskPage(
    "/remote-operation-task/meter-reading-task",
    "Meter Reading Task",
    "Meter Reading Task",
    "/API/RemoteMeterTask/GetReadingTask",
    { columns: meterReadingTaskColumns, filters: [searchFilter] },
  ),
  createReadOnlyTaskPage(
    "/remote-operation-task/meter-setting-task",
    "Meter Setting Task",
    "Meter Setting Task",
    "/API/RemoteMeterTask/GetSettingTask",
    { columns: genericTaskColumns, filters: [searchFilter] },
  ),
  createReadOnlyTaskPage(
    "/remote-operation-task/meter-control-task",
    "Meter Control Task",
    "Meter Control Task",
    "/API/RemoteMeterTask/GetControlTask",
    { columns: meterControlTaskColumns, filters: [searchFilter] },
  ),
  createReadOnlyTaskPage(
    "/remote-operation-task/meter-token-task",
    "Meter Token Task",
    "Meter Token Task",
    "/API/RemoteMeterTask/GetTokenTask",
    { columns: meterTokenTaskColumns, filters: [searchFilter] },
  ),
  createReadOnlyTaskPage(
    "/remote-operation-task/transparent-forwarding-task",
    "Transparent Forwarding Task",
    "Transparent Forwarding Task",
    "/API/RemoteMeterTask/GetTransparentForwardingTask",
    { columns: genericTaskColumns, filters: [searchFilter] },
  ),
];
