import { randomUUID } from "node:crypto";
import { env } from "./env.js";
import { getRedisClient } from "./redis-client.js";

interface SchedulerLeaderCallbacks {
  onLeadershipAcquired: () => void;
  onLeadershipLost: () => void;
}

export interface SchedulerLeaderStatus {
  coordinationMode: "redis" | "single-instance";
  isLeader: boolean;
  leaseKey: string;
  instanceId: string;
  lastLeadershipChangeAt: string | null;
  lastLeadershipError: string | null;
}

const RENEW_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("PSETEX", KEYS[1], ARGV[2], ARGV[1])
end
return 0
`;

const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

export class SchedulerLeader {
  private readonly instanceId = randomUUID();
  private readonly leaseKey: string;
  private readonly callbacks: SchedulerLeaderCallbacks;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isLeader = false;
  private lastLeadershipChangeAt: string | null = null;
  private lastLeadershipError: string | null = null;

  constructor(engineKey: string, callbacks: SchedulerLeaderCallbacks) {
    this.leaseKey = `${env.schedulerLeaderKeyPrefix}${engineKey}`;
    this.callbacks = callbacks;
  }

  public start() {
    if (this.heartbeatTimer) {
      return;
    }

    void this.reconcileLeadership();
    this.heartbeatTimer = setInterval(() => {
      void this.reconcileLeadership();
    }, env.schedulerLeaderHeartbeatMs);
  }

  public async stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    await this.releaseLeadership();
  }

  public getStatus(): SchedulerLeaderStatus {
    return {
      coordinationMode: env.schedulerCoordinationMode,
      isLeader: this.isLeader,
      leaseKey: this.leaseKey,
      instanceId: this.instanceId,
      lastLeadershipChangeAt: this.lastLeadershipChangeAt,
      lastLeadershipError: this.lastLeadershipError,
    };
  }

  public currentlyLeads() {
    return this.isLeader;
  }

  private async reconcileLeadership() {
    if (env.schedulerCoordinationMode === "single-instance") {
      if (!this.isLeader) {
        this.becomeLeader();
      }
      return;
    }

    try {
      const client = await getRedisClient();
      if (!client) {
        this.recordLeadershipError("Redis client unavailable");
        if (this.isLeader) {
          this.loseLeadership();
        }
        return;
      }

      if (this.isLeader) {
        const renewed = await client.eval(RENEW_SCRIPT, {
          keys: [this.leaseKey],
          arguments: [this.instanceId, String(env.schedulerLeaderLeaseMs)],
        });

        if (renewed === 0) {
          this.loseLeadership();
        }
        return;
      }

      const acquired = await client.set(this.leaseKey, this.instanceId, {
        NX: true,
        PX: env.schedulerLeaderLeaseMs,
      });

      if (acquired === "OK") {
        this.becomeLeader();
      }
    } catch (error) {
      this.recordLeadershipError(
        error instanceof Error ? error.message : "Leadership reconciliation failed",
      );
      if (this.isLeader) {
        this.loseLeadership();
      }
    }
  }

  private async releaseLeadership() {
    if (env.schedulerCoordinationMode === "single-instance") {
      if (this.isLeader) {
        this.loseLeadership();
      }
      return;
    }

    try {
      const client = await getRedisClient();
      if (client && this.isLeader) {
        await client.eval(RELEASE_SCRIPT, {
          keys: [this.leaseKey],
          arguments: [this.instanceId],
        });
      }
    } catch (error) {
      this.recordLeadershipError(
        error instanceof Error ? error.message : "Leadership release failed",
      );
    } finally {
      if (this.isLeader) {
        this.loseLeadership();
      }
    }
  }

  private becomeLeader() {
    this.isLeader = true;
    this.lastLeadershipChangeAt = new Date().toISOString();
    this.lastLeadershipError = null;
    this.callbacks.onLeadershipAcquired();
  }

  private loseLeadership() {
    this.isLeader = false;
    this.lastLeadershipChangeAt = new Date().toISOString();
    this.callbacks.onLeadershipLost();
  }

  private recordLeadershipError(message: string) {
    this.lastLeadershipError = message;
  }
}
