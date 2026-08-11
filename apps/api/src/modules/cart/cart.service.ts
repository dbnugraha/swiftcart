import {
  applyDiscount,
  calculateTotals,
  ERROR_CODES,
  type Cart,
  type CartLine,
  type Product,
} from "@swiftcart/shared";

import { prisma } from "../../db/prisma.js";
import { conflict, notFound, unprocessable } from "../../lib/errors.js";
import { isUuid } from "../../lib/ids.js";

/**
 * A sanity bound, not a business rule — it only exists to keep quantities and
 * payloads reasonable. **Stock is the real limit**, enforced below and again
 * inside the checkout transaction.
 */
const MAX_QUANTITY_PER_LINE = 99;

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

function toProductDTO(row: ProductRow): Product {
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

/**
 * Prices are always recomputed from the product rows, never stored on the cart
 * line. A cart can sit for days; the customer must see today's price, and the
 * total must equal the sum of the lines they can actually see.
 */
export async function getCart(userId: string): Promise<Cart> {
  const rows = await prisma.cartItem.findMany({
    where: { userId },
    include: { product: true },
    orderBy: { createdAt: "asc" },
  });

  const lines: CartLine[] = rows.map((row) => {
    const product = toProductDTO(row.product);
    return {
      productId: product.id,
      quantity: row.quantity,
      product,
      lineTotal: product.salePrice * row.quantity,
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  return {
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    ...calculateTotals(subtotal),
  };
}

async function requireProduct(productId: string): Promise<ProductRow> {
  if (!isUuid(productId)) {
    throw notFound(ERROR_CODES.PRODUCT_NOT_FOUND, "No such product.");
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw notFound(ERROR_CODES.PRODUCT_NOT_FOUND, "No such product.");

  return product;
}

/**
 * Idempotent add. The unique index on (userId, productId) means a second add
 * of the same product increments rather than creating a duplicate line — which
 * is what a shopper expects, and what makes an optimistic client retry safe.
 */
export async function addToCart(
  userId: string,
  productId: string,
  quantity: number,
): Promise<Cart> {
  const product = await requireProduct(productId);

  const existing = await prisma.cartItem.findUnique({
    where: { userId_productId: { userId, productId } },
  });

  const nextQuantity = (existing?.quantity ?? 0) + quantity;

  if (nextQuantity > MAX_QUANTITY_PER_LINE) {
    throw unprocessable(
      ERROR_CODES.VALIDATION_FAILED,
      `You can order at most ${MAX_QUANTITY_PER_LINE} of one item.`,
      [{ field: "quantity", message: `Limit is ${MAX_QUANTITY_PER_LINE}.` }],
    );
  }

  // Checked here for a fast, clear message. It is NOT the guarantee — stock is
  // re-checked inside the checkout transaction, because anything can change
  // between adding to a cart and paying for it.
  if (nextQuantity > product.stock) {
    throw conflict(
      ERROR_CODES.OUT_OF_STOCK,
      product.stock === 0
        ? `${product.title} is out of stock.`
        : `Only ${product.stock} left of ${product.title}.`,
      [{ field: "quantity", message: `${product.stock} available.` }],
    );
  }

  await prisma.cartItem.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, quantity },
    update: { quantity: nextQuantity },
  });

  return getCart(userId);
}

/**
 * Absolute set, and an UPSERT — the line need not exist yet.
 *
 * That makes this a single idempotent operation the client can use for adding,
 * changing and removing alike: it always states the quantity it wants, and
 * sending the same value twice is a no-op. Coalescing rapid taps into one
 * request is only safe because of that.
 */
export async function setQuantity(
  userId: string,
  productId: string,
  quantity: number,
): Promise<Cart> {
  const product = await requireProduct(productId);

  if (quantity === 0) {
    // Already absent is the state that was asked for, so converge quietly
    // rather than 404 the way an explicit DELETE does.
    await prisma.cartItem.deleteMany({ where: { userId, productId } });
    return getCart(userId);
  }

  if (quantity > MAX_QUANTITY_PER_LINE) {
    throw unprocessable(
      ERROR_CODES.VALIDATION_FAILED,
      `You can order at most ${MAX_QUANTITY_PER_LINE} of one item.`,
      [{ field: "quantity", message: `Limit is ${MAX_QUANTITY_PER_LINE}.` }],
    );
  }

  if (quantity > product.stock) {
    throw conflict(
      ERROR_CODES.OUT_OF_STOCK,
      `Only ${product.stock} left of ${product.title}.`,
      [{ field: "quantity", message: `${product.stock} available.` }],
    );
  }

  await prisma.cartItem.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, quantity },
    update: { quantity },
  });

  return getCart(userId);
}

export async function removeFromCart(userId: string, productId: string): Promise<Cart> {
  if (!isUuid(productId)) {
    throw notFound(ERROR_CODES.NOT_IN_CART, "That item isn't in your cart.");
  }

  const result = await prisma.cartItem.deleteMany({ where: { userId, productId } });

  if (result.count === 0) {
    throw notFound(ERROR_CODES.NOT_IN_CART, "That item isn't in your cart.");
  }

  return getCart(userId);
}

export async function clearCart(userId: string): Promise<Cart> {
  await prisma.cartItem.deleteMany({ where: { userId } });
  return getCart(userId);
}
