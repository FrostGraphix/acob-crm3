export interface AccessPolicy {
  requiredRole?: string;
  requiredPermissions?: string[];
}

const policyByPrefix: Array<{ prefix: string; policy: AccessPolicy }> = [
  {
    prefix: "/api/Log",
    policy: {
      requiredRole: "admin",
      requiredPermissions: [
        "SystemLog.SystemLog",
        "SystemLog.Read",
        "Log.SystemLog",
        "Log.Log",
      ],
    },
  },
  {
    prefix: "/API/EventNotification",
    policy: {
      requiredPermissions: [
        "EventNotification.EventNotification",
        "EventNotification.Read",
        "EventNotification",
      ],
    },
  },
  {
    prefix: "/api/theft",
    policy: {
      requiredRole: "admin",
    },
  },
  { prefix: "/api/token", policy: {} },
  { prefix: "/API/PrepayReport", policy: {} },
  { prefix: "/API/RemoteMeterTask", policy: {} },
  { prefix: "/api/remoteMeterTask", policy: {} },
  { prefix: "/API/GPRSMeterTask", policy: {} },
  { prefix: "/api/GPRSMeterTask", policy: {} },
  { prefix: "/API/GPRSOnlineStatus", policy: {} },
  { prefix: "/api/gprsOnlineStatus", policy: {} },
  { prefix: "/API/UpdateFirmwareTask", policy: {} },
  { prefix: "/api/updateFirmwareTask", policy: {} },
  { prefix: "/API/LoadProfile", policy: {} },
  { prefix: "/api/loadProfile", policy: {} },
  { prefix: "/api/DailyData", policy: {} },
  { prefix: "/api/dailyData", policy: {} },
  { prefix: "/api/management/analytics", policy: {} },
  { prefix: "/api/site-consumption", policy: {} },
  { prefix: "/api/operations", policy: {} },
  { prefix: "/api/debt", policy: {} },
  { prefix: "/api/dlms", policy: {} },
  { prefix: "/api/dlt645", policy: {} },
  { prefix: "/api/DLT645Task", policy: {} },
  { prefix: "/api/vendor", policy: {} },
  { prefix: "/api/wallet", policy: {} },
  { prefix: "/api/reconciliation", policy: {} },
  { prefix: "/api/item", policy: {} },
  { prefix: "/api/station", policy: {} },
  { prefix: "/api/role", policy: {} },
  { prefix: "/api/user", policy: {} },
  { prefix: "/api/customer", policy: {} },
  { prefix: "/api/account", policy: {} },
  { prefix: "/api/meter", policy: {} },
  { prefix: "/api/tariff", policy: {} },
  { prefix: "/api/gateway", policy: {} },
];

export function resolveAccessPolicy(pathname: string): AccessPolicy | null {
  const entry = policyByPrefix.find((candidate) => pathname.startsWith(candidate.prefix));
  return entry?.policy ?? null;
}
