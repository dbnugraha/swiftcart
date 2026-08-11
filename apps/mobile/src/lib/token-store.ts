import * as SecureStore from "expo-secure-store";

import type { PublicUser } from "@swiftcart/shared";

/**
 * The single owner of session credentials.
 *
 * SecureStore is the durable copy; the module-level `memory` mirror lets the
 * api client attach a bearer synchronously instead of awaiting a keychain read
 * on every request, and lets the single-flight refresh compare the token it
 * started with against the one now current.
 */

const ACCESS_KEY = "swiftcart.access";
const REFRESH_KEY = "swiftcart.refresh";
const USER_KEY = "swiftcart.user";

export type SessionTokens = { accessToken: string; refreshToken: string };

let memory: SessionTokens | null = null;

export const getAccessToken = (): string | null => memory?.accessToken ?? null;
export const getRefreshToken = (): string | null => memory?.refreshToken ?? null;

function isUser(value: unknown): value is PublicUser {
  if (typeof value !== "object" || value === null) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === "string" &&
    typeof user.name === "string" &&
    typeof user.email === "string"
  );
}

/**
 * Cold-start read. A half-written session (app killed between two writes) is
 * treated as no session rather than something to repair.
 */
export async function restoreSession(): Promise<{
  user: PublicUser;
  tokens: SessionTokens;
} | null> {
  const [accessToken, refreshToken, rawUser] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
    SecureStore.getItemAsync(USER_KEY),
  ]);

  if (!accessToken || !refreshToken || !rawUser) {
    memory = null;
    return null;
  }

  let user: unknown;
  try {
    user = JSON.parse(rawUser);
  } catch {
    await clearSession();
    return null;
  }

  if (!isUser(user)) {
    await clearSession();
    return null;
  }

  memory = { accessToken, refreshToken };
  return { user, tokens: memory };
}

export async function persistSession(
  user: PublicUser,
  tokens: SessionTokens,
): Promise<void> {
  // Mirror first, so a request racing this write already carries the new token.
  memory = tokens;

  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
  ]);
}

/** Post-rotation update. Leaves the stored user untouched. */
export async function persistTokens(tokens: SessionTokens): Promise<void> {
  memory = tokens;

  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
  ]);
}

export async function clearSession(): Promise<void> {
  memory = null;

  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}
