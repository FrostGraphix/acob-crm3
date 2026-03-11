import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AuthUser } from "../../../common/types/index.js";
import { env } from "./env.js";

type SupabaseModule = typeof import("@supabase/supabase-js");

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function mapSupabaseUser(user: User): AuthUser {
  const metadata = typeof user.user_metadata === "object" && user.user_metadata !== null
    ? user.user_metadata as Record<string, unknown>
    : {};
  const appMetadata = typeof user.app_metadata === "object" && user.app_metadata !== null
    ? user.app_metadata as Record<string, unknown>
    : {};

  const username =
    readString(metadata.username) ??
    readString(user.email) ??
    readString(user.phone) ??
    user.id;
  const displayName =
    readString(metadata.display_name) ??
    readString(metadata.full_name) ??
    readString(metadata.name) ??
    username;
  const role =
    readString(appMetadata.role) ??
    readString(metadata.role) ??
    "User";

  return {
    username,
    displayName,
    role,
  };
}

let supabaseModulePromise: Promise<SupabaseModule> | null = null;
let supabaseAuthClientPromise: Promise<SupabaseClient> | null = null;
let supabaseAdminClientPromise: Promise<SupabaseClient> | null = null;

async function getSupabaseModule() {
  if (!supabaseModulePromise) {
    supabaseModulePromise = import("@supabase/supabase-js");
  }

  return supabaseModulePromise;
}

async function createSupabaseClient(supabaseKey: string) {
  const { createClient } = await getSupabaseModule();

  return createClient(env.supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

const hasSupabaseBaseConfig = env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
const hasSupabaseServiceRoleConfig =
  hasSupabaseBaseConfig &&
  env.supabaseServiceRoleKey.length > 0 &&
  env.supabaseStorageBucket.length > 0;

async function getAuthClient() {
  if (!hasSupabaseBaseConfig) {
    throw new Error("Supabase auth is not configured");
  }

  if (!supabaseAuthClientPromise) {
    supabaseAuthClientPromise = createSupabaseClient(env.supabaseAnonKey);
  }

  return supabaseAuthClientPromise;
}

async function getStorageClient() {
  if (!hasSupabaseServiceRoleConfig) {
    throw new Error("Supabase storage is not configured");
  }

  if (!supabaseAdminClientPromise) {
    supabaseAdminClientPromise = createSupabaseClient(env.supabaseServiceRoleKey);
  }

  return supabaseAdminClientPromise;
}

function getSessionMaxAgeMs(expiresInSeconds: number | null) {
  if (typeof expiresInSeconds !== "number" || !Number.isFinite(expiresInSeconds)) {
    return 60 * 60 * 1000;
  }

  return Math.max(60, Math.floor(expiresInSeconds)) * 1000;
}

export function isSupabaseAuthEnabled() {
  return env.supabaseAuthEnabled && hasSupabaseBaseConfig;
}

export function isSupabaseStorageEnabled() {
  return env.supabaseStorageEnabled && hasSupabaseServiceRoleConfig;
}

export interface SupabaseAuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string | null;
  maxAgeMs: number;
}

export interface SupabaseStorageObject {
  id: string | null;
  name: string;
  createdAt: string | null;
  updatedAt: string | null;
  lastAccessedAt: string | null;
  size: number | null;
}

export interface SupabaseSignedUploadUrl {
  path: string;
  token: string;
  signedUrl: string;
}

export interface SupabaseSignedDownloadUrl {
  path: string;
  signedUrl: string;
}

function toSupabaseSessionPayload(data: {
  user: User | null;
  session: {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
  } | null;
}) {
  if (!data.user || !data.session) {
    return null;
  }

  return {
    user: mapSupabaseUser(data.user),
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    maxAgeMs: getSessionMaxAgeMs(data.session.expires_in ?? null),
  } satisfies SupabaseAuthSession;
}

export async function signInWithSupabasePassword(credentials: {
  email: string;
  password: string;
}) {
  const authClient = await getAuthClient();
  const { data, error } = await authClient.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) {
    throw new Error(error.message);
  }

  const session = toSupabaseSessionPayload({
    user: data.user,
    session: data.session,
  });
  if (!session) {
    throw new Error("Supabase login did not return a session");
  }

  return session;
}

export async function getSupabaseUserFromAccessToken(accessToken: string) {
  let client: SupabaseClient | null = null;

  if (hasSupabaseServiceRoleConfig) {
    client = await getStorageClient();
  } else if (hasSupabaseBaseConfig) {
    client = await getAuthClient();
  }

  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    return null;
  }

  return mapSupabaseUser(data.user);
}

export async function refreshSupabaseAccessToken(refreshToken: string) {
  try {
    const authClient = await getAuthClient();
    const { data, error } = await authClient.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      return null;
    }

    return toSupabaseSessionPayload({
      user: data.user,
      session: data.session,
    });
  } catch {
    return null;
  }
}

export async function revokeSupabaseSession(accessToken: string) {
  if (!hasSupabaseBaseConfig) {
    return;
  }

  const { createClient } = await getSupabaseModule();
  const scopedClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  await scopedClient.auth.signOut();
}

export async function listSupabaseStorageObjects(prefix: string, limit: number) {
  const storageClient = await getStorageClient();
  const { data, error } = await storageClient.storage
    .from(env.supabaseStorageBucket)
    .list(prefix, {
      limit,
      sortBy: { column: "name", order: "asc" },
    });

  if (error) {
    throw new Error(error.message);
  }

  return data.map((entry) => ({
    id: readString(entry.id),
    name: entry.name,
    createdAt: readString(entry.created_at),
    updatedAt: readString(entry.updated_at),
    lastAccessedAt: readString(entry.last_accessed_at),
    size: typeof entry.metadata?.size === "number" ? entry.metadata.size : null,
  } satisfies SupabaseStorageObject));
}

export async function createSupabaseSignedUploadUrl(path: string) {
  const storageClient = await getStorageClient();
  const { data, error } = await storageClient.storage
    .from(env.supabaseStorageBucket)
    .createSignedUploadUrl(path);

  if (error) {
    throw new Error(error.message);
  }

  return {
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
  } satisfies SupabaseSignedUploadUrl;
}

export async function createSupabaseSignedDownloadUrl(path: string, expiresIn: number) {
  const storageClient = await getStorageClient();
  const { data, error } = await storageClient.storage
    .from(env.supabaseStorageBucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(error.message);
  }

  return {
    path,
    signedUrl: data.signedUrl,
  } satisfies SupabaseSignedDownloadUrl;
}

export async function uploadSupabaseObject(params: {
  path: string;
  payload: Buffer;
  contentType?: string;
  upsert?: boolean;
}) {
  const storageClient = await getStorageClient();
  const { data, error } = await storageClient.storage
    .from(env.supabaseStorageBucket)
    .upload(params.path, params.payload, {
      contentType: params.contentType,
      upsert: params.upsert ?? false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return {
    path: data.path,
    id: readString(data.id),
    fullPath: readString(data.fullPath),
  };
}

export async function removeSupabaseStorageObjects(paths: string[]) {
  const storageClient = await getStorageClient();
  const { data, error } = await storageClient.storage
    .from(env.supabaseStorageBucket)
    .remove(paths);

  if (error) {
    throw new Error(error.message);
  }

  return data.map((entry) => ({
    name: entry.name,
    id: readString(entry.id),
  }));
}
