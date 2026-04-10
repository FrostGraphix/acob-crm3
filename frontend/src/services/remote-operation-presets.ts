import type { ActionConfig } from "../types";

export interface RemotePreset {
  key: string;
  label: string;
  description: string;
  values: Record<string, string>;
}

export function getRemotePresetLabel(taskType: ActionConfig["remoteTaskType"]) {
  switch (taskType) {
    case "reading":
      return "Common reads";
    case "setting":
      return "Common settings";
    case "control":
      return "Common control actions";
    case "token":
      return "Common token actions";
    case "transparent-forwarding":
      return "Advanced command templates";
    default:
      return "Suggested templates";
  }
}

export function getRemotePresets(action: ActionConfig): RemotePreset[] {
  switch (action.remoteTaskType) {
    case "reading":
      return [
        {
          key: "instant-read",
          label: "Quick Meter Read",
          description: "A simple one-time reading using the catalog item you select below.",
          values: { taskName: "Quick Meter Read", readMode: "single" },
        },
        {
          key: "profile-read",
          label: "Profile Read",
          description: "Use when you want a profile-style reading from the selected item.",
          values: { taskName: "Profile Read", readMode: "profile" },
        },
      ];
    case "setting":
      return [
        {
          key: "clock-sync",
          label: "Clock Sync",
          description: "Update a meter time-related setting.",
          values: { taskName: "Clock Sync", settingKey: "meterTime", valueType: "string" },
        },
        {
          key: "tariff-setting",
          label: "Tariff Update",
          description: "Prepare a tariff-related remote setting change.",
          values: { taskName: "Tariff Update", settingKey: "tariffId", valueType: "string" },
        },
      ];
    case "control":
      return [
        {
          key: "disconnect",
          label: "Disconnect Meter",
          description: "Queue a disconnect command for the selected meter.",
          values: { taskName: "Disconnect Meter", controlCommand: "disconnect", reason: "Operator initiated disconnect" },
        },
        {
          key: "reconnect",
          label: "Reconnect Meter",
          description: "Queue a reconnect command for the selected meter.",
          values: { taskName: "Reconnect Meter", controlCommand: "connect", reason: "Operator initiated reconnect" },
        },
      ];
    case "token":
      return [
        {
          key: "credit-token",
          label: "Send Credit Token",
          description: "Prepare a standard credit token command.",
          values: { taskName: "Send Credit Token", tokenType: "credit" },
        },
        {
          key: "clear-credit",
          label: "Clear Credit",
          description: "Prepare a clear-credit token action.",
          values: { taskName: "Clear Credit", tokenType: "clear-credit" },
        },
      ];
    case "transparent-forwarding":
      return [
        {
          key: "hex-command",
          label: "HEX Command",
          description: "Send a raw command in HEX mode.",
          values: { taskName: "HEX Forwarding", protocolMode: "hex", timeoutSeconds: "30" },
        },
        {
          key: "ascii-command",
          label: "ASCII Command",
          description: "Send a raw command in ASCII mode.",
          values: { taskName: "ASCII Forwarding", protocolMode: "ascii", timeoutSeconds: "30" },
        },
      ];
    default:
      return [];
  }
}

export function getRemoteTaskFriendlyName(taskType: ActionConfig["remoteTaskType"]) {
  switch (taskType) {
    case "reading":
      return "Read meter data";
    case "setting":
      return "Change a meter setting";
    case "control":
      return "Control meter service";
    case "token":
      return "Send a remote token";
    case "transparent-forwarding":
      return "Send an advanced raw command";
    default:
      return "Run remote operation";
  }
}
