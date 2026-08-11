import { hash, verify } from "@node-rs/argon2";

/**
 * `@node-rs/argon2` rather than `argon2`: it ships prebuilt binaries for
 * win32-x64-msvc, linux-x64-gnu and linux-x64-musl, so it installs without a
 * node-gyp toolchain on the dev machine or in Alpine.
 */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(
  storedHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    // A malformed hash is a failed login, not a 500.
    return false;
  }
}

/**
 * Burns comparable CPU when the email doesn't exist, so response timing can't
 * be used to enumerate which addresses are registered.
 */
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$k9Zx1vTQyPWJXo2ZmQKZ0Y3EMlPz3RtVPGqQvS0ZrLo";

export async function fakeVerify(): Promise<void> {
  await verifyPassword(DUMMY_HASH, "not-the-password");
}
