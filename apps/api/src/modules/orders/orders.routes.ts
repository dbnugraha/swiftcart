import { Router } from "express";
import { z } from "zod";

import { authed, requireAuth } from "../../middleware/require-auth.js";
import { pathParam, validateBody } from "../../middleware/validate.js";
import * as service from "./orders.service.js";

/**
 * Shipping details only — there is deliberately no payment step. A real
 * checkout would take a payment intent here and place the order on its
 * confirmation.
 */
const checkoutSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required.").max(120),
  addressLine: z.string().trim().min(1, "Address is required.").max(200),
  city: z.string().trim().min(1, "City is required.").max(80),
  postalCode: z
    .string()
    .trim()
    .min(3, "Postal code is too short.")
    .max(12, "Postal code is too long."),
  country: z.string().trim().min(2, "Country is required.").max(60),
});

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

ordersRouter.get("/", async (req, res) => {
  res.json({ items: await service.listOrders(authed(req).userId) });
});

ordersRouter.post("/", validateBody(checkoutSchema), async (req, res) => {
  res.status(201).json(await service.placeOrder(authed(req).userId, req.body));
});

ordersRouter.get("/:id", async (req, res) => {
  res.json(await service.getOrder(authed(req).userId, pathParam(req.params, "id")));
});
