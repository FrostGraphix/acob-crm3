import { getWalletReconciliationService } from "./wallet-reconciliation.js";

interface WalletReconciliationEngineStatus {
  name: "wallet-reconciliation-engine";
  enabledByConfig: true;
  schedulerRunning: boolean;
  lastRunStartedAt: string | null;
  lastRunCompletedAt: string | null;
  lastError: string | null;
  intervalMinutes: number;
}

const INTERVAL_MS = 10 * 60_000;

let timer: NodeJS.Timeout | null = null;
let lastRunStartedAt: string | null = null;
let lastRunCompletedAt: string | null = null;
let lastError: string | null = null;

function createSystemContext() {
  return {
    actorUserId: "wallet-reconciliation-engine",
    actorUsername: "wallet.reconciliation.engine",
    actorDisplayName: "Wallet Reconciliation Engine",
    appRole: "finance" as const,
    vendorId: null,
    siteCode: null,
    permissions: [],
    authProvider: "legacy" as const,
    sessionId: null,
  };
}

async function executeRun() {
  lastRunStartedAt = new Date().toISOString();
  try {
    const result = await getWalletReconciliationService().runNow(createSystemContext(), {
      dryRun: false,
    });
    if (result.accepted && result.run) {
      lastRunCompletedAt = result.run.completedAt;
    }
    lastError = null;
    return result;
  } catch (error) {
    lastError = error instanceof Error ? error.message : "Wallet reconciliation engine failed";
    throw error;
  }
}

export const walletReconciliationEngine = {
  getStatus(): WalletReconciliationEngineStatus {
    return {
      name: "wallet-reconciliation-engine",
      enabledByConfig: true,
      schedulerRunning: timer !== null,
      lastRunStartedAt,
      lastRunCompletedAt,
      lastError,
      intervalMinutes: INTERVAL_MS / 60_000,
    };
  },

  start() {
    if (timer) {
      return;
    }

    getWalletReconciliationService().setSchedulerRunning(true);
    timer = setInterval(() => {
      void executeRun();
    }, INTERVAL_MS);
  },

  stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    getWalletReconciliationService().setSchedulerRunning(false);
  },

  async runNow() {
    return executeRun();
  },
};

export function getWalletReconciliationEngine() {
  return walletReconciliationEngine;
}
