import assert from "node:assert/strict";
import test from "node:test";

let resetWalletDomainState;
let resetWalletPersistenceMirrorState;
let getWalletDomainState;
let getWalletLedgerService;
let getWalletReconciliationService;

test.before(async () => {
  process.env.NODE_ENV = "test";
  process.env.SESSION_STORE_MODE = "memory";
  process.env.SUPABASE_AUTH_ENABLED = "false";
  process.env.SUPABASE_STORAGE_ENABLED = "false";

  const [walletStoreModule, walletPersistenceModule, ledgerModule, reconciliationModule] = await Promise.all([
    import("../../backend/dist/backend/src/services/wallet-domain-store.js"),
    import("../../backend/dist/backend/src/services/wallet-persistence.js"),
    import("../../backend/dist/backend/src/services/wallet-ledger.js"),
    import("../../backend/dist/backend/src/services/wallet-reconciliation.js"),
  ]);

  resetWalletDomainState = walletStoreModule.resetWalletDomainState;
  resetWalletPersistenceMirrorState = walletPersistenceModule.resetWalletPersistenceMirrorState;
  getWalletDomainState = walletStoreModule.getWalletDomainState;
  getWalletLedgerService = ledgerModule.getWalletLedgerService;
  getWalletReconciliationService = reconciliationModule.getWalletReconciliationService;
});

test.beforeEach(() => {
  resetWalletDomainState();
  resetWalletPersistenceMirrorState();
});

test("wallet reconciliation service raises balance drift exception when snapshot diverges from ledger", async () => {
  const ledgerService = getWalletLedgerService();
  const reconciliationService = getWalletReconciliationService();

  const wallet = ledgerService.provisionWallet({
    vendorId: "VENDOR_DRIFT",
    siteCode: "SITE_001",
    createdBy: "finance-user",
  });
  ledgerService.postFundingCredit({
    walletId: wallet.id,
    vendorId: wallet.vendorId,
    siteCode: wallet.siteCode,
    amount: 1500,
    reference: "FND-DRIFT-1",
    postedBy: "finance-user",
    metadata: {
      description: "Initial funding for reconciliation drift test",
    },
  });

  const state = getWalletDomainState();
  const driftedWallet = state.wallets.get(wallet.id);
  driftedWallet.availableBalance = 1400;
  state.wallets.set(wallet.id, driftedWallet);

  const result = await reconciliationService.runNow({
    actorUserId: "finance-user",
    actorUsername: "finance.user",
    actorDisplayName: "Finance User",
    appRole: "finance",
    vendorId: null,
    siteCode: null,
    permissions: [],
    authProvider: "legacy",
  });

  assert.equal(result.accepted, true);
  assert.ok(result.run.exceptionCount >= 1);
  assert.equal(result.run.stageSummaries.length, 5);
  assert.equal(result.summary.total, 1);

  const exceptions = reconciliationService.listExceptions({
    actorUserId: "finance-user",
    actorUsername: "finance.user",
    actorDisplayName: "Finance User",
    appRole: "finance",
    vendorId: null,
    siteCode: null,
    permissions: [],
    authProvider: "legacy",
  });
  assert.ok(exceptions.rows.some((entry) => entry.type === "balance_drift"));

  const detail = reconciliationService.getExceptionDetail(
    {
      actorUserId: "finance-user",
      actorUsername: "finance.user",
      actorDisplayName: "Finance User",
      appRole: "finance",
      vendorId: null,
      siteCode: null,
      permissions: [],
      authProvider: "legacy",
    },
    exceptions.rows[0].id,
  );
  assert.equal(detail.id, exceptions.rows[0].id);
});
