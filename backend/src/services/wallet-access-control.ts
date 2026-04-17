import type { WalletActorRole } from "./wallet-domain-store.js";

export interface WalletRoutePolicy {
  allowedRoles: WalletActorRole[];
  description: string;
}

interface WalletRoutePolicyDefinition extends WalletRoutePolicy {
  method: "GET" | "POST";
  pattern: RegExp;
}

const walletRoutePolicies: WalletRoutePolicyDefinition[] = [
  {
    method: "GET",
    pattern: /^\/api\/vendor\/checklist$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager", "vendor_manager", "vendor_user"],
    description: "wallet checklist",
  },
  {
    method: "GET",
    pattern: /^\/api\/vendor\/onboarding\/queue$/i,
    allowedRoles: ["super_admin", "admin", "finance"],
    description: "vendor onboarding approval queue",
  },
  {
    method: "POST",
    pattern: /^\/api\/vendor\/approval\/approve$/i,
    allowedRoles: ["super_admin", "admin", "finance"],
    description: "vendor onboarding approval action",
  },
  {
    method: "GET",
    pattern: /^\/api\/vendor(?:\/me|\/[^/]+)?$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager", "vendor_manager", "vendor_user"],
    description: "vendor summary",
  },
  {
    method: "POST",
    pattern: /^\/api\/vendor\/invite$/i,
    allowedRoles: ["super_admin", "admin"],
    description: "vendor credential creation",
  },
  {
    method: "POST",
    pattern: /^\/api\/vendor\/profile$/i,
    allowedRoles: ["super_admin", "admin"],
    description: "vendor profile creation",
  },
  {
    method: "POST",
    pattern: /^\/api\/vendor\/[^/]+\/onboarding$/i,
    allowedRoles: ["super_admin", "admin", "finance", "vendor_manager", "vendor_user"],
    description: "vendor onboarding update",
  },
  {
    method: "POST",
    pattern: /^\/api\/vendor\/[^/]+\/bank-account$/i,
    allowedRoles: ["super_admin", "admin", "finance", "vendor_manager", "vendor_user"],
    description: "vendor bank account update",
  },
  {
    method: "POST",
    pattern: /^\/api\/vendor\/[^/]+\/approve$/i,
    allowedRoles: ["super_admin", "admin", "finance"],
    description: "vendor approval",
  },
  {
    method: "POST",
    pattern: /^\/api\/vendor\/[^/]+\/(?:suspend|reactivate)$/i,
    allowedRoles: ["super_admin", "admin", "ops_manager"],
    description: "vendor status change",
  },
  {
    method: "GET",
    pattern: /^\/api\/wallet\/(?:summary|overview|transactions|statement|history|receipts|profile)$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager", "vendor_manager", "vendor_user"],
    description: "wallet read access",
  },
  {
    method: "GET",
    pattern: /^\/api\/wallet\/commission\/(?:summary|history)$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager", "vendor_manager", "vendor_user"],
    description: "wallet commission read access",
  },
  {
    method: "GET",
    pattern: /^\/api\/wallet\/commission\/rules$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager"],
    description: "commission rule listing",
  },
  {
    method: "POST",
    pattern: /^\/api\/wallet\/commission\/rules(?:\/[^/]+)?$/i,
    allowedRoles: ["super_admin", "admin", "finance"],
    description: "commission rule update",
  },
  {
    method: "POST",
    pattern: /^\/api\/wallet\/commission\/rules-update$/i,
    allowedRoles: ["super_admin", "admin", "finance"],
    description: "commission rule update",
  },
  {
    method: "GET",
    pattern: /^\/api\/wallet\/finance\/kpis$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager"],
    description: "wallet finance kpis",
  },
  {
    method: "GET",
    pattern: /^\/api\/wallet\/settlement\/(?:preview|batches|batches\/[^/]+)$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager"],
    description: "wallet settlement read access",
  },
  {
    method: "POST",
    pattern: /^\/api\/wallet\/settlement\/preview$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager"],
    description: "wallet settlement preview",
  },
  {
    method: "POST",
    pattern: /^\/api\/wallet\/settlement\/run$/i,
    allowedRoles: ["super_admin", "admin", "finance"],
    description: "wallet settlement posting",
  },
  {
    method: "GET",
    pattern: /^\/api\/wallet\/approvals$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager"],
    description: "wallet approval queue",
  },
  {
    method: "GET",
    pattern: /^\/api\/wallet\/security\/session-log$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager", "vendor_manager", "vendor_user"],
    description: "vendor session log",
  },
  {
    method: "GET",
    pattern: /^\/api\/wallet\/alerts$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager", "vendor_manager", "vendor_user"],
    description: "wallet operational alerts",
  },
  {
    method: "GET",
    pattern: /^\/api\/wallet\/go-live-readiness$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager"],
    description: "wallet go-live readiness",
  },
  {
    method: "GET",
    pattern: /^\/api\/wallet\/[^/]+\/purchases$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager", "vendor_manager", "vendor_user"],
    description: "wallet purchase history",
  },
  {
    method: "GET",
    pattern: /^\/api\/wallet\/purchase\/[^/]+$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager", "vendor_manager", "vendor_user"],
    description: "wallet purchase detail",
  },
  {
    method: "GET",
    pattern: /^\/api\/wallet\/meters\/search$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager", "vendor_manager", "vendor_user"],
    description: "wallet meter search",
  },
  {
    method: "GET",
    pattern: /^\/api\/wallet\/funding-request\/[^/]+$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager", "vendor_manager", "vendor_user"],
    description: "funding request detail",
  },
  {
    method: "GET",
    pattern: /^\/api\/wallet\/[^/]+\/funding\/history$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager", "vendor_manager", "vendor_user"],
    description: "funding history",
  },
  {
    method: "GET",
    pattern: /^\/api\/wallet\/funding\/pending$/i,
    allowedRoles: ["super_admin", "admin", "finance"],
    description: "funding approval queue",
  },
  {
    method: "POST",
    pattern: /^\/api\/wallet\/funding(?:\/initiate|\/request|-request)$/i,
    allowedRoles: ["vendor_user"],
    description: "funding initiation",
  },
  {
    method: "POST",
    pattern: /^\/api\/wallet\/funding\/[^/]+\/(?:proof|upload-proof)$/i,
    allowedRoles: ["vendor_user"],
    description: "funding proof upload",
  },
  {
    method: "POST",
    pattern: /^\/api\/wallet\/funding\/[^/]+\/cancel$/i,
    allowedRoles: ["vendor_user"],
    description: "funding cancel",
  },
  {
    method: "POST",
    pattern: /^\/api\/wallet\/funding\/[^/]+\/approve$/i,
    allowedRoles: ["super_admin", "admin", "finance"],
    description: "funding approval",
  },
  {
    method: "POST",
    pattern: /^\/api\/wallet\/funding\/[^/]+\/reject$/i,
    allowedRoles: ["super_admin", "admin", "finance"],
    description: "funding rejection",
  },
  {
    method: "POST",
    pattern: /^\/api\/wallet\/funding\/reject$/i,
    allowedRoles: ["super_admin", "admin", "finance"],
    description: "funding rejection queue action",
  },
  {
    method: "POST",
    pattern: /^\/api\/wallet\/funding\/approve$/i,
    allowedRoles: ["super_admin", "admin", "finance"],
    description: "funding approval queue action",
  },
  {
    method: "POST",
    pattern: /^\/api\/wallet\/purchase\/(?:remote-send|generate-token)$/i,
    allowedRoles: ["vendor_user"],
    description: "wallet purchase",
  },
  {
    method: "GET",
    pattern: /^\/api\/wallet\/receipt\/[^/]+(?:\/print)?$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager", "vendor_manager", "vendor_user"],
    description: "wallet receipt",
  },
  {
    method: "POST",
    pattern: /^\/api\/wallet\/reversal\/request$/i,
    allowedRoles: ["vendor_user"],
    description: "wallet reversal request",
  },
  {
    method: "POST",
    pattern: /^\/api\/wallet\/manual-credit\/request$/i,
    allowedRoles: ["super_admin", "admin", "finance"],
    description: "manual wallet credit request",
  },
  {
    method: "POST",
    pattern: /^\/api\/wallet\/limits\/[^/]+\/credit-limit$/i,
    allowedRoles: ["super_admin", "admin", "finance"],
    description: "wallet credit limit update",
  },
  {
    method: "POST",
    pattern: /^\/api\/wallet\/(?:freeze|unfreeze)\/request$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager"],
    description: "wallet freeze management",
  },
  {
    method: "POST",
    pattern: /^\/api\/wallet\/approvals\/[^/]+\/(?:approve|reject)$/i,
    allowedRoles: ["super_admin", "admin", "finance"],
    description: "wallet approval action",
  },
  {
    method: "GET",
    pattern: /^\/api\/reconciliation\/(?:status|summary|exceptions|exceptions\/[^/]+|settlement\/[^/]+)$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager"],
    description: "reconciliation read access",
  },
  {
    method: "POST",
    pattern: /^\/api\/reconciliation\/run$/i,
    allowedRoles: ["super_admin", "admin", "finance"],
    description: "reconciliation execution",
  },
  {
    method: "POST",
    pattern: /^\/api\/reconciliation\/exceptions\/[^/]+\/(?:assign|resolve|escalate)$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager"],
    description: "exception management",
  },
  {
    method: "POST",
    pattern: /^\/api\/reconciliation\/exceptions\/(?:assign|resolve|escalate)$/i,
    allowedRoles: ["super_admin", "admin", "finance", "ops_manager"],
    description: "exception queue management",
  },
];

export function resolveWalletRoutePolicy(method: string, pathname: string) {
  const normalizedMethod = method.trim().toUpperCase();
  return (
    walletRoutePolicies.find(
      (policy) => policy.method === normalizedMethod && policy.pattern.test(pathname),
    ) ?? null
  );
}

export function isWalletRoleAllowed(role: WalletActorRole, allowedRoles: WalletActorRole[]) {
  return allowedRoles.includes(role);
}
