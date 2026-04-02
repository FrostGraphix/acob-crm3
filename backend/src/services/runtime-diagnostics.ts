import { env } from "./env.js";

export interface RuntimeDiagnosticsSnapshot {
  service: string;
  nodeEnv: "development" | "test" | "production";
  sessionStoreMode: "redis" | "memory";
  runtimeStateStoreMode: "redis" | "file";
  schedulerCoordinationMode: "redis" | "single-instance";
  supabaseAuthEnabled: boolean;
  supabaseStorageEnabled: boolean;
  strictDependencyStartup: boolean;
  rateLimit: {
    windowMs: number;
    maxRequestsPerWindow: number;
    trustForwardedFor: boolean;
  };
  backgroundServices: {
    analysisEngine: {
      enabled: boolean;
      schedule: string;
    };
    siteConsumptionEngine: {
      enabled: boolean;
      schedule: string;
    };
  };
}

export function readRuntimeDiagnostics(): RuntimeDiagnosticsSnapshot {
  return {
    service: "acob-crm3-backend",
    nodeEnv: env.nodeEnv,
    sessionStoreMode: env.sessionStoreMode,
    runtimeStateStoreMode: env.runtimeStateStoreMode,
    schedulerCoordinationMode: env.schedulerCoordinationMode,
    supabaseAuthEnabled: env.supabaseAuthEnabled,
    supabaseStorageEnabled: env.supabaseStorageEnabled,
    strictDependencyStartup: env.strictDependencyStartup,
    rateLimit: {
      windowMs: env.rateLimitWindowMs,
      maxRequestsPerWindow: env.rateLimitMaxRequestsPerWindow,
      trustForwardedFor: env.rateLimitTrustForwardedFor,
    },
    backgroundServices: {
      analysisEngine: {
        enabled: env.enableAnalysisEngine,
        schedule: "*/15 * * * *",
      },
      siteConsumptionEngine: {
        enabled: env.enableSiteConsumptionEngine,
        schedule: "*/30 * * * *",
      },
    },
  };
}
