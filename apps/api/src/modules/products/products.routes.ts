import { Router } from "express";
import { z } from "zod";

import { PRODUCT_SORTS } from "@swiftcart/shared";

import { parsedQuery, pathParam, validateQuery } from "../../middleware/validate.js";
import * as service from "./products.service.js";

const listQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  category: z.string().trim().max(80).optional(),
  sort: z.enum(PRODUCT_SORTS).default("name-asc"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const randomQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(30).default(15),
});

export const productsRouter = Router();

// The catalogue is public: browsing without an account is normal for a shop,
// and requiring auth here would make the app useless before sign-up.
productsRouter.get("/", validateQuery(listQuerySchema), async (_req, res) => {
  res.json(await service.listProducts(parsedQuery<service.ListParams>(res)));
});

productsRouter.get("/categories", async (_req, res) => {
  res.json({ categories: await service.listCategories() });
});

// Before "/:id" so the literal path isn't captured as an id.
productsRouter.get("/random", validateQuery(randomQuerySchema), async (_req, res) => {
  const { count } = parsedQuery<{ count: number }>(res);
  res.json({ items: await service.randomProducts(count) });
});

productsRouter.get("/:id", async (req, res) => {
  res.json(await service.getProduct(pathParam(req.params, "id")));
});
