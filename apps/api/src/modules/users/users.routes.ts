import { Router } from "express";

import { ERROR_CODES, type Profile } from "@swiftcart/shared";

import { prisma } from "../../db/prisma.js";
import { notFound } from "../../lib/errors.js";
import { authed, requireAuth } from "../../middleware/require-auth.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get("/", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: authed(req).userId },
    include: { _count: { select: { orders: true } } },
  });

  if (!user) throw notFound(ERROR_CODES.NOT_FOUND, "Account not found.");

  const profile: Profile = {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    orderCount: user._count.orders,
  };

  res.json(profile);
});
