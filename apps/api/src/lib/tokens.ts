import { createHash, randomBytes, randomUUID } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";

import { env } from "../env.js";

const secret = new TextEncoder().encode(env.JWT_SECRET);

export type AccessClaims = {
  sub: string;
  jti: string;
  exp: number;
};

function ttlSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) throw new Error(`Unsupported ACCESS_TOKEN_TTL: ${ttl}`);

  const value = Number(match[1]);
  const unit = match[2] as "s" | "m" | "h" | "d";
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit];

  return value * multiplier;
}

export async function signAccessToken(userId: string) {
  const expiresIn = ttlSeconds(env.ACCESS_TOKEN_TTL);

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(secret);

  return { token, expiresIn };
}

/** Resolves to null on any failure — expiry, tampering, wrong algorithm. */
export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });

    if (!payload.sub || !payload.jti || !payload.exp) return null;
    return { sub: payload.sub, jti: payload.jti, exp: payload.exp };
  } catch {
    return null;
  }
}

/**
 * Refresh tokens are 256 bits of CSPRNG output with no structure to attack, so
 * sha256 is the right hash here — argon2 would buy nothing and would turn a
 * unique-index lookup into a per-row verification.
 */
export function mintRefreshToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshExpiryDate(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
}
