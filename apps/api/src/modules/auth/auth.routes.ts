import { Router } from "express";
import rateLimit from "express-rate-limit";

import { ERROR_CODES } from "@swiftcart/shared";

import { authed, requireAuth } from "../../middleware/require-auth.js";
import { validateBody } from "../../middleware/validate.js";
import { refreshSchema, signInSchema, signUpSchema } from "./auth.schema.js";
import * as service from "./auth.service.js";

const limited = (limit: number) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: {
        code: ERROR_CODES.RATE_LIMITED,
        message: "Too many attempts. Try again shortly.",
      },
    },
  });

export const authRouter = Router();

// Credential endpoints get a tight bucket; refresh gets a looser one because a
// legitimately busy client rotates on a schedule.
authRouter.post("/sign-up", limited(10), validateBody(signUpSchema), async (req, res) => {
  res.status(201).json(await service.signUp(req.body));
});

authRouter.post("/sign-in", limited(10), validateBody(signInSchema), async (req, res) => {
  res.json(await service.signIn(req.body));
});

authRouter.post("/refresh", limited(60), validateBody(refreshSchema), async (req, res) => {
  res.json(await service.refresh(req.body.refreshToken));
});

// No auth required: a client with an expired access token must still be able
// to sign out.
authRouter.post("/sign-out", async (req, res) => {
  await service.signOut(req.body?.refreshToken);
  res.status(204).end();
});

authRouter.post("/sign-out-all", requireAuth, async (req, res) => {
  await service.signOutAll(authed(req).userId);
  res.status(204).end();
});
