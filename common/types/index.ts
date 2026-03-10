export interface AmrResponse<T> {
  code: number;
  reason: string;
  result: T;
}

export interface AmrRequest<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  pageNumber?: number;
  pageSize?: number;
  searchTerm?: string;
  payload?: TPayload;
}

export interface AuthUser {
  username: string;
  displayName: string;
  role: string;
}

export interface AuthSessionToken {
  user: AuthUser;
  issuedAt: number;
}

export interface ApiRowsResponse<TRow extends Record<string, unknown>> {
  rows: TRow[];
  total: number;
}

export interface ActionResponse {
  success: boolean;
  message: string;
}
