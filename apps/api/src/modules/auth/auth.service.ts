import { randomUUID } from "node:crypto";

import { ERROR_CODES, type Session } from "@swiftcart/shared";

import { prisma } from "../../db/prisma.js";
import { conflict, unauthorized } from "../../lib/errors.js";
import { fakeVerify, hashPassword, verifyPassword } from "../../lib/password.js";
import {
  hashRefreshToken,
  mintRefreshToken,
  refreshExpiryDate,
  signAccessToken,
} from "../../lib/tokens.js";
import type { SignInInput, SignUpInput } from "./auth.schema.js";

type UserRow = { id: string; name: string; email: string };

async function issueSession(user: UserRow, familyId: string): Promise<Session> {
  const { token: refreshToken, tokenHash } = mintRefreshToken();
  const access = await signAccessToken(user.id);

  await prisma.refreshToken.create({
    data: { userId: user.id, familyId, tokenHash, expiresAt: refreshExpiryDate() },
  });

  return {
    user: { id: user.id, name: user.name, email: user.email },
    accessToken: access.token,
    refreshToken,
    expiresIn: access.expiresIn,
  };
}

export async function signUp(input: SignUpInput): Promise<Session> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });

  if (existing) {
    throw conflict(ERROR_CODES.EMAIL_TAKEN, "That email is already registered.", [
      { field: "email", message: "Already registered." },
    ]);
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
    },
  });

  return issueSession(user, randomUUID());
}

export async function signIn(input: SignInInput): Promise<Session> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user) {
    // Burn comparable CPU so response timing can't enumerate registered emails.
    await fakeVerify();
    throw unauthorized(ERROR_CODES.INVALID_CREDENTIALS, "Email or password is invalid.");
  }

  if (!(await verifyPassword(user.passwordHash, input.password))) {
    throw unauthorized(ERROR_CODES.INVALID_CREDENTIALS, "Email or password is invalid.");
  }

  return issueSession(user, randomUUID());
}

/**
 * Rotation with reuse detection.
 *
 * Every refresh mints a new token and revokes the presented one, keeping the
 * family. Presenting an already-revoked token means it leaked or was replayed,
 * so the WHOLE family is revoked and every session in that lineage dies.
 *
 * There is deliberately no grace window: the client serialises refreshes
 * behind a single-flight promise, so a legitimate double-submit shouldn't
 * happen, and a grace window would weaken the one guarantee this exists to
 * give.
 */
export async function refresh(presented: string): Promise<Omit<Session, "user">> {
  const tokenHash = hashRefreshToken(presented);
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!row || row.expiresAt <= new Date()) {
    throw unauthorized(ERROR_CODES.INVALID_REFRESH, "Your session has expired.");
  }

  if (row.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { familyId: row.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw unauthorized(ERROR_CODES.TOKEN_REUSE_DETECTED, "Your session has expired.");
  }

  const { token: refreshToken, tokenHash: nextHash } = mintRefreshToken();
  const access = await signAccessToken(row.userId);

  await prisma.$transaction(async (tx) => {
    const created = await tx.refreshToken.create({
      data: {
        userId: row.userId,
        familyId: row.familyId,
        tokenHash: nextHash,
        expiresAt: refreshExpiryDate(),
      },
    });

    await tx.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date(), replacedById: created.id },
    });
  });

  return { accessToken: access.token, refreshToken, expiresIn: access.expiresIn };
}

/**
 * Always resolves. A sign-out that errors leaves the user stuck on a screen
 * they asked to leave, and reporting "that token wasn't valid" leaks nothing
 * useful.
 */
export async function signOut(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;

  await prisma.refreshToken
    .updateMany({
      where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    })
    .catch(() => undefined);
}

export async function signOutAll(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
