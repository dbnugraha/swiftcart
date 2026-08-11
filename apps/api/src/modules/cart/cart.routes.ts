import { Router } from "express";
import { z } from "zod";

import { authed, requireAuth } from "../../middleware/require-auth.js";
import { pathParam, validateBody } from "../../middleware/validate.js";
import * as service from "./cart.service.js";

// Kept in step with MAX_QUANTITY_PER_LINE in cart.service.ts, which explains
// why the bound exists at all.
const MAX_QUANTITY = 99;

const addSchema = z.object({
  productId: z.string().min(1, "A product is required."),
  quantity: z.coerce.number().int().min(1).max(MAX_QUANTITY).default(1),
});

const quantitySchema = z.object({
  quantity: z.coerce.number().int().min(0).max(MAX_QUANTITY),
});

export const cartRouter = Router();

cartRouter.use(requireAuth);

cartRouter.get("/", async (req, res) => {
  res.json(await service.getCart(authed(req).userId));
});

cartRouter.post("/items", validateBody(addSchema), async (req, res) => {
  const { productId, quantity } = req.body;
  res.status(201).json(await service.addToCart(authed(req).userId, productId, quantity));
});

cartRouter.patch(
  "/items/:productId",
  validateBody(quantitySchema),
  async (req, res) => {
    const productId = pathParam(req.params, "productId");
    res.json(
      await service.setQuantity(authed(req).userId, productId, req.body.quantity),
    );
  },
);

cartRouter.delete("/items/:productId", async (req, res) => {
  const productId = pathParam(req.params, "productId");
  res.json(await service.removeFromCart(authed(req).userId, productId));
});

cartRouter.delete("/", async (req, res) => {
  res.json(await service.clearCart(authed(req).userId));
});
