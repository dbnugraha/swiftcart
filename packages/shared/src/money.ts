/**
 * Money is integer minor units (cents) everywhere — in the database, over the
 * wire, and in client state.
 *
 * Floating point cannot represent most decimal fractions exactly, so prices
 * held as `number` drift the moment you add them up: 0.1 + 0.2 === 0.30000000000000004.
 * On a cart of ten items that becomes a total that disagrees with the sum of
 * its own lines, which is the kind of bug users notice and never forgive.
 *
 * Conversion to a decimal happens once, at the very edge, for display only.
 */

export type Cents = number;

/** `9.99` -> `999`. Used when importing upstream data, never on internal maths. */
export function toCents(amount: number): Cents {
  return Math.round(amount * 100);
}

export function formatCents(cents: Cents, currency = "USD", locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/** Percentage off, rounded to whole cents. `discountPercentage` is 0–100. */
export function applyDiscount(cents: Cents, discountPercentage: number): Cents {
  const clamped = Math.min(Math.max(discountPercentage, 0), 100);
  return Math.round(cents * (1 - clamped / 100));
}

export const TAX_RATE = 0.08;
/** Orders at or above this subtotal ship free. */
export const FREE_SHIPPING_THRESHOLD: Cents = 5000;
export const SHIPPING_FLAT: Cents = 599;

export type OrderTotals = {
  subtotal: Cents;
  tax: Cents;
  shipping: Cents;
  total: Cents;
};

/**
 * The single definition of what an order costs.
 *
 * Shared rather than duplicated because the client previews totals during
 * checkout and the server computes the authoritative figures — and a customer
 * seeing one number then being charged another is the worst class of bug this
 * app could ship. The server still recomputes from its own prices; this only
 * guarantees the two use identical arithmetic.
 */
export function calculateTotals(subtotal: Cents): OrderTotals {
  const tax = Math.round(subtotal * TAX_RATE);
  const shipping =
    subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;

  return { subtotal, tax, shipping, total: subtotal + tax + shipping };
}
