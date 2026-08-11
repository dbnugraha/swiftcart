import {
  applyDiscount,
  ERROR_CODES,
  type Page,
  type Product,
  type ProductDetail,
  type ProductSort,
} from "@swiftcart/shared";

import { prisma } from "../../db/prisma.js";
import { notFound } from "../../lib/errors.js";
import { isUuid } from "../../lib/ids.js";
import type { Prisma } from "../../generated/prisma/client.js";

type ProductRow = {
  id: string;
  sku: string;
  title: string;
  description: string;
  category: string;
  brand: string | null;
  priceCents: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  thumbnail: string;
  images: string[];
  tags: string[];
};

/**
 * `salePrice` is derived here rather than stored, so a change to the discount
 * rule can never leave a stale column disagreeing with the price shown.
 */
function toDTO(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    title: row.title,
    description: row.description,
    category: row.category,
    brand: row.brand,
    price: row.priceCents,
    discountPercentage: row.discountPercentage,
    salePrice: applyDiscount(row.priceCents, row.discountPercentage),
    rating: row.rating,
    stock: row.stock,
    thumbnail: row.thumbnail,
    images: row.images,
    tags: row.tags,
  };
}

const ORDER_BY: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  "name-asc": [{ title: "asc" }],
  "name-desc": [{ title: "desc" }],
  "price-asc": [{ priceCents: "asc" }],
  "price-desc": [{ priceCents: "desc" }],
  "rating-desc": [{ rating: "desc" }],
};

export type ListParams = {
  search?: string;
  category?: string;
  sort: ProductSort;
  limit: number;
  offset: number;
};

export async function listProducts(params: ListParams): Promise<Page<Product>> {
  const where: Prisma.ProductWhereInput = {
    ...(params.category ? { category: params.category } : {}),
    ...(params.search
      ? {
          OR: [
            { title: { contains: params.search, mode: "insensitive" } },
            { brand: { contains: params.search, mode: "insensitive" } },
            { tags: { has: params.search.toLowerCase() } },
          ],
        }
      : {}),
  };

  // Count and page in one round trip. A secondary `id` sort keeps paging
  // stable — without it, rows with equal titles or prices can swap between
  // pages and a product appears twice or not at all.
  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [...(ORDER_BY[params.sort] as Prisma.ProductOrderByWithRelationInput[]), { id: "asc" as const }],
      skip: params.offset,
      take: params.limit,
    }),
  ]);

  return {
    items: rows.map(toDTO),
    total,
    limit: params.limit,
    offset: params.offset,
    hasMore: params.offset + rows.length < total,
  };
}

export async function getProduct(id: string): Promise<ProductDetail> {
  // Postgres rejects a malformed uuid at the driver level, which would surface
  // as a 500. A bad id is simply not a product that exists.
  if (!isUuid(id)) throw notFound(ERROR_CODES.PRODUCT_NOT_FOUND, "No such product.");

  const row = await prisma.product.findUnique({
    where: { id },
    include: { reviews: { orderBy: { createdAt: "desc" }, take: 20 } },
  });

  if (!row) throw notFound(ERROR_CODES.PRODUCT_NOT_FOUND, "No such product.");

  return {
    ...toDTO(row),
    reviews: row.reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      reviewerName: review.reviewerName,
      createdAt: review.createdAt.toISOString(),
    })),
  };
}

export async function listCategories(): Promise<{ name: string; count: number }[]> {
  const grouped = await prisma.product.groupBy({
    by: ["category"],
    _count: { _all: true },
    orderBy: { category: "asc" },
  });

  return grouped.map((row) => ({ name: row.category, count: row._count._all }));
}

/** Random picks for the discovery deck. In-stock only — you can't buy the rest. */
export async function randomProducts(count: number): Promise<Product[]> {
  const rows = await prisma.$queryRaw<ProductRow[]>`
    SELECT id, sku, title, description, category, brand,
           "priceCents", "discountPercentage", rating, stock,
           thumbnail, images, tags
    FROM products
    WHERE stock > 0
    ORDER BY random()
    LIMIT ${count}
  `;

  return rows.map(toDTO);
}
