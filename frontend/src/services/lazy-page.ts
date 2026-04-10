interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface LazyImportEnvironment {
  storage: StorageLike | null;
  reload: (() => void) | null;
}

const LAZY_IMPORT_RECOVERY_PREFIX = "acob-crm:lazy-import-recovery:";
const RECOVERABLE_IMPORT_PATTERNS = [
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "chunkloaderror",
  "loading chunk",
];

function toErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error ?? "");
}

function getLazyImportEnvironment(): LazyImportEnvironment {
  if (typeof window === "undefined") {
    return { storage: null, reload: null };
  }

  return {
    storage: window.sessionStorage ?? null,
    reload:
      typeof window.location?.reload === "function"
        ? () => window.location.reload()
        : null,
  };
}

export function getLazyImportRecoveryKey(pageKey: string) {
  return `${LAZY_IMPORT_RECOVERY_PREFIX}${pageKey}`;
}

export function isRecoverableLazyImportError(error: unknown) {
  const message = toErrorMessage(error).toLowerCase();
  return RECOVERABLE_IMPORT_PATTERNS.some((pattern) => message.includes(pattern));
}

export function clearLazyImportRecovery(
  pageKey: string,
  environment: LazyImportEnvironment = getLazyImportEnvironment(),
) {
  environment.storage?.removeItem(getLazyImportRecoveryKey(pageKey));
}

export function attemptLazyImportRecovery(
  pageKey: string,
  error: unknown,
  environment: LazyImportEnvironment = getLazyImportEnvironment(),
) {
  if (!isRecoverableLazyImportError(error)) {
    return false;
  }

  const { storage, reload } = environment;
  if (!storage || !reload) {
    return false;
  }

  const recoveryKey = getLazyImportRecoveryKey(pageKey);
  if (storage.getItem(recoveryKey) === "1") {
    return false;
  }

  storage.setItem(recoveryKey, "1");
  reload();
  return true;
}

export async function loadLazyPage<
  TModule extends Record<string, unknown>,
  TExport extends keyof TModule,
>(
  pageKey: string,
  importer: () => Promise<TModule>,
  exportName: TExport,
  environment: LazyImportEnvironment = getLazyImportEnvironment(),
): Promise<{ default: TModule[TExport] }> {
  try {
    const module = await importer();
    clearLazyImportRecovery(pageKey, environment);

    if (!(exportName in module)) {
      throw new Error(`Module "${pageKey}" is missing export "${String(exportName)}".`);
    }

    return { default: module[exportName] };
  } catch (error) {
    if (attemptLazyImportRecovery(pageKey, error, environment)) {
      return new Promise(() => {});
    }

    throw error;
  }
}
