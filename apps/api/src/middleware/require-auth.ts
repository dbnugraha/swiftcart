import type { Request, RequestHandler } from "express";

import { ERROR_CODES } from "@swiftcart/shared";

import { unauthorized } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/tokens.js";

export type AuthedRequest = Request & { userId: string };

/** Narrowing accessor, so handlers don't cast at every use. */
export function authed(req: Request): AuthedRequest {
  return req as AuthedRequest;
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return next(
      unauthorized(ERROR_CODES.UNAUTHENTICATED, "Sign in to continue."),
    );
  }

  const claims = await verifyAccessToken(header.slice(7).trim());

  if (!claims) {
    // Deliberately the same message and code as a missing header: telling the
    // caller *why* a token failed helps an attacker more than a user.
    return next(
      unauthorized(ERROR_CODES.UNAUTHENTICATED, "Sign in to continue."),
    );
  }

  authed(req).userId = claims.sub;
  next();
};
