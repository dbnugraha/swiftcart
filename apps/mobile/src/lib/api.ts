import { ERROR_CODES, type ApiErrorBody } from "@swiftcart/shared";

import { API_BASE_URL, API_URL_HELP } from "./config";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  persistTokens,
} from "./token-store";

/**
 * The only way the app talks to the Swiftcart API.
 *
 * Two things here are load-bearing:
 *
 * 1. **Refresh is single-flight.** Several screens fetch on mount, so requests
 *    routinely 401 in the same tick. The server rotates refresh tokens with
 *    reuse detection and no grace window, so two concurrent refreshes would
 *    present the same token twice, the second would look like a replay, and
 *    the entire token family would be revoked — signing the user out. The
 *    module-level `refreshPromise` prevents that. It is not an optimisation.
 *
 * 2. **Retry happens at most once**, only for an authenticated request that
 *    got a 401. Everything else surfaces immediately.
 */

const TIMEOUT_MS = 15_000;

export type FieldError = { field: string; message: string };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: FieldError[],
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** First field message if the server sent one, else the general message. */
  get displayMessage(): string {
    return this.fields?.[0]?.message ?? this.message;
  }

  /** True when retrying the same request could plausibly succeed. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError;

export function hasCode(error: unknown, code: string): boolean {
  return isApiError(error) && error.code === code;
}

/**
 * Called when the refresh token itself is rejected — the session is gone and
 * cannot be recovered. Registered by the auth context; a callback rather than
 * an import so this module never depends on React state.
 */
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Send the bearer and refresh-and-retry on 401. Default true. */
  auth?: boolean;
  signal?: AbortSignal;
};

function parseError(status: number, payload: unknown): ApiError {
  const envelope = (payload as ApiErrorBody | null)?.error;

  if (envelope && typeof envelope === "object") {
    return new ApiError(
      status,
      typeof envelope.code === "string" ? envelope.code : ERROR_CODES.INTERNAL,
      typeof envelope.message === "string" ? envelope.message : "Something went wrong.",
      Array.isArray(envelope.fields) ? envelope.fields : undefined,
    );
  }

  return new ApiError(status, ERROR_CODES.INTERNAL, `Request failed (${status}).`);
}

/**
 * Composes the caller's signal with a timeout. Hand-rolled rather than using
 * `AbortSignal.any`/`timeout` because Hermes support varies, and because a
 * caller abort and a timeout must stay distinguishable — an aborted request is
 * not an error, a timed-out one is.
 */
function composeSignal(caller: AbortSignal | undefined) {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);

  const forward = () => controller.abort();

  if (caller) {
    if (caller.aborted) controller.abort();
    else caller.addEventListener("abort", forward);
  }

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      caller?.removeEventListener("abort", forward);
    },
  };
}

async function rawFetch(
  path: string,
  options: RequestOptions,
  accessToken: string | null,
): Promise<Response> {
  const { signal, didTimeout, cleanup } = composeSignal(options.signal);

  const headers: Record<string, string> = {
    accept: "application/json",
    "Bypass-Tunnel-Reminder": "true",
    ...options.headers,
  };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
    });
  } catch (error) {
    // A caller abort is not a failure — let it through untouched so screens
    // can ignore their own cancellations.
    if (options.signal?.aborted) throw error;

    if (didTimeout()) {
      throw new ApiError(0, "TIMEOUT", "The server took too long to respond.");
    }

    throw new ApiError(
      0,
      "NETWORK",
      "Can't reach the server. Check your connection and try again.",
    );
  } finally {
    cleanup();
  }
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

let refreshPromise: Promise<void> | null = null;

async function performRefresh(): Promise<void> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new ApiError(401, ERROR_CODES.UNAUTHENTICATED, "Your session has expired.");
  }

  const response = await rawFetch(
    "/auth/refresh",
    { method: "POST", body: { refreshToken }, auth: false },
    null,
  );

  if (!response.ok) throw parseError(response.status, await readBody(response));

  const payload = (await readBody(response)) as {
    accessToken?: string;
    refreshToken?: string;
  } | null;

  if (!payload?.accessToken || !payload.refreshToken) {
    throw new ApiError(500, ERROR_CODES.INTERNAL, "Your session has expired.");
  }

  await persistTokens({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
  });
}

/**
 * Refreshes once per burst. `staleToken` is the access token the caller held
 * when it got its 401: if the current token already differs, another caller's
 * refresh has landed and this one only needs to retry.
 */
async function ensureRefreshed(staleToken: string | null): Promise<void> {
  if (staleToken !== null && getAccessToken() !== staleToken) return;

  if (!refreshPromise) {
    refreshPromise = performRefresh()
      .catch(async (error: unknown) => {
        // The refresh token is dead. Drop the session and tell the auth
        // context, which flips the root guard back to the sign-in screen.
        await clearSession();
        onSessionExpired?.();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  await refreshPromise;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_BASE_URL) throw new ApiError(0, "NO_API_URL", API_URL_HELP);

  const useAuth = options.auth !== false;
  const accessToken = useAuth ? getAccessToken() : null;

  let response = await rawFetch(path, options, accessToken);

  if (response.status === 401 && useAuth) {
    await ensureRefreshed(accessToken);
    response = await rawFetch(path, options, getAccessToken());
  }

  const payload = await readBody(response);
  if (!response.ok) throw parseError(response.status, payload);

  return payload as T;
}

type BodylessOptions = Omit<RequestOptions, "method" | "body">;

export const api = {
  get: <T>(path: string, options?: BodylessOptions) =>
    apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: BodylessOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: BodylessOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  del: <T>(path: string, options?: BodylessOptions) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};

/** Human-readable text for anything thrown by this module. */
export function errorMessage(error: unknown): string {
  if (isApiError(error)) return error.displayMessage;
  return "Something went wrong. Please try again.";
}
