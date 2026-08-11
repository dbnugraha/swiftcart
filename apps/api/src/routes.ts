import { Router } from "express";

import { assertDatabaseReachable } from "./db/prisma.js";
import { logger } from "./lib/logger.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { cartRouter } from "./modules/cart/cart.routes.js";
import { ordersRouter } from "./modules/orders/orders.routes.js";
import { productsRouter } from "./modules/products/products.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";

export const v1 = Router();

v1.use("/auth", authRouter);
v1.use("/me", usersRouter);
v1.use("/products", productsRouter);
v1.use("/cart", cartRouter);
v1.use("/orders", ordersRouter);

export const health = Router();

/**
 * 503 only when the database is unreachable — that is the one dependency the
 * API genuinely cannot serve without, so it is the only thing that should make
 * an orchestrator restart or drain this instance.
 */
health.get("/healthz", async (_req, res) => {
  try {
    await assertDatabaseReachable();
    res.json({ status: "ok", db: "up", uptime: Math.round(process.uptime()) });
  } catch (error) {
    logger.error({ err: error }, "Health check failed");
    res.status(503).json({ status: "unavailable", db: "down" });
  }
});
