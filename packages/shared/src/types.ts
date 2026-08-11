import type { Cents, OrderTotals } from "./money.js";

/**
 * The API's wire contract, imported by both sides.
 *
 * This is the whole reason the repo is a monorepo: the server's response
 * builders and the client's fetch wrapper are checked against one definition,
 * so renaming a field breaks the build instead of the app.
 */

export type PublicUser = {
  id: string;
  name: string;
  email: string;
};

export type Session = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type Profile = PublicUser & {
  createdAt: string;
  orderCount: number;
};

export type Product = {
  id: string;
  sku: string;
  title: string;
  description: string;
  category: string;
  brand: string | null;
  /** Pre-discount price. */
  price: Cents;
  discountPercentage: number;
  /** `price` with `discountPercentage` applied — what the customer pays. */
  salePrice: Cents;
  rating: number;
  stock: number;
  thumbnail: string;
  images: string[];
  tags: string[];
};

export type Review = {
  id: string;
  rating: number;
  comment: string;
  reviewerName: string;
  createdAt: string;
};

export type ProductDetail = Product & {
  reviews: Review[];
};

export const PRODUCT_SORTS = [
  "name-asc",
  "name-desc",
  "price-asc",
  "price-desc",
  "rating-desc",
] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number];

export type Page<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type CartLine = {
  productId: string;
  quantity: number;
  /** Snapshotted for display; the server always re-reads price at checkout. */
  product: Product;
  lineTotal: Cents;
};

export type Cart = OrderTotals & {
  lines: CartLine[];
  itemCount: number;
};

export type OrderStatus = "PLACED" | "PACKED" | "SHIPPED" | "DELIVERED";

export type OrderLine = {
  productId: string | null;
  /** Title and price at time of purchase — never re-read from the catalogue. */
  title: string;
  thumbnail: string;
  unitPrice: Cents;
  quantity: number;
  lineTotal: Cents;
};

export type ShippingAddress = {
  fullName: string;
  addressLine: string;
  city: string;
  postalCode: string;
  country: string;
};

export type Order = OrderTotals & {
  id: string;
  reference: string;
  status: OrderStatus;
  createdAt: string;
  lines: OrderLine[];
  shippingAddress: ShippingAddress;
};

/** Every non-2xx response body. */
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    fields?: { field: string; message: string }[];
  };
};
