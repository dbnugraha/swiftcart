import { randomBytes } from "node:crypto";

import {
  applyDiscount,
  calculateTotals,
  ERROR_CODES,
  type Order,
  type ShippingAddress,
} from "@swiftcart/shared";

import { prisma } from "../../db/prisma.js";
import { conflict, notFound } from "../../lib/errors.js";
import { isUuid } from "../../lib/ids.js";

/** Short, unambiguous, and safe to read aloud — no 0/O or 1/I. */
function orderReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  const code = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
  return `SC-${code}`;
}

type OrderRow = {
  id: string;
  reference: string;
  status: "PLACED" | "PACKED" | "SHIPPED" | "DELIVERED";
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  shippingFullName: string;
  shippingAddressLine: string;
  shippingCity: string;
  shippingPostalCode: string;
  shippingCountry: string;
  createdAt: Date;
  items: {
    productId: string | null;
    title: string;
    thumbnail: string;
    unitPrice: number;
    quantity: number;
  }[];
};

function toDTO(row: OrderRow): Order {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    subtotal: row.subtotalCents,
    tax: row.taxCents,
    shipping: row.shippingCents,
    total: row.totalCents,
    shippingAddress: {
      fullName: row.shippingFullName,
      addressLine: row.shippingAddressLine,
      city: row.shippingCity,
      postalCode: row.shippingPostalCode,
      country: row.shippingCountry,
    },
    lines: row.items.map((item) => ({
      productId: item.productId,
      title: item.title,
      thumbnail: item.thumbnail,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.unitPrice * item.quantity,
    })),
  };
}

/**
 * Places an order. There is no payment step — this is where one would go.
 *
 * Everything happens in a single transaction, and stock is decremented with a
 * conditional UPDATE rather than a read-then-write. Two shoppers checking out
 * the last unit at the same moment would both pass a `SELECT stock` check;
 * `WHERE stock >= quantity` lets the database arbitrate, and the loser gets a
 * clean 409 instead of the shop overselling.
 */
export async function placeOrder(
  userId: string,
  address: ShippingAddress,
): Promise<Order> {
  const created = await prisma.$transaction(async (tx) => {
    const cartItems = await tx.cartItem.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { createdAt: "asc" },
    });

    if (cartItems.length === 0) {
      throw conflict(ERROR_CODES.CART_EMPTY, "Your cart is empty.");
    }

    let subtotal = 0;
    const lines: {
      productId: string;
      title: string;
      thumbnail: string;
      unitPrice: number;
      quantity: number;
    }[] = [];

    for (const item of cartItems) {
      // Conditional decrement — the guard and the write are one statement, so
      // nothing can slip between them.
      const claimed = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });

      if (claimed.count === 0) {
        // Throwing rolls back every decrement already made in this
        // transaction, so a partial order can never be committed.
        throw conflict(
          ERROR_CODES.OUT_OF_STOCK,
          `${item.product.title} sold out while you were checking out.`,
          [{ field: item.productId, message: "No longer available." }],
        );
      }

      // Price is captured now and stored on the line. A later price change
      // must never rewrite what this customer was charged.
      const unitPrice = applyDiscount(
        item.product.priceCents,
        item.product.discountPercentage,
      );

      subtotal += unitPrice * item.quantity;

      lines.push({
        productId: item.productId,
        title: item.product.title,
        thumbnail: item.product.thumbnail,
        unitPrice,
        quantity: item.quantity,
      });
    }

    const totals = calculateTotals(subtotal);

    const order = await tx.order.create({
      data: {
        userId,
        reference: orderReference(),
        subtotalCents: totals.subtotal,
        taxCents: totals.tax,
        shippingCents: totals.shipping,
        totalCents: totals.total,
        shippingFullName: address.fullName,
        shippingAddressLine: address.addressLine,
        shippingCity: address.city,
        shippingPostalCode: address.postalCode,
        shippingCountry: address.country,
        items: { create: lines },
      },
      include: { items: true },
    });

    // Same transaction: the cart must not survive an order made from it, and
    // must come back intact if the order fails.
    await tx.cartItem.deleteMany({ where: { userId } });

    return order;
  });

  return toDTO(created);
}

export async function listOrders(userId: string): Promise<Order[]> {
  const rows = await prisma.order.findMany({
    where: { userId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return rows.map(toDTO);
}

export async function getOrder(userId: string, id: string): Promise<Order> {
  if (!isUuid(id)) throw notFound(ERROR_CODES.ORDER_NOT_FOUND, "Order not found.");

  // Scoped by userId, so another customer's order is a 404 rather than a 403 —
  // a 403 would confirm it exists.
  const row = await prisma.order.findFirst({
    where: { id, userId },
    include: { items: true },
  });

  if (!row) throw notFound(ERROR_CODES.ORDER_NOT_FOUND, "Order not found.");

  return toDTO(row);
}
