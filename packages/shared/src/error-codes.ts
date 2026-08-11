/**
 * Machine-readable error codes.
 *
 * The client switches on these, never on message text — messages are for
 * humans and change freely; codes are the contract. Shared so a typo in one
 * half is a compile error rather than a branch that silently never runs.
 */
export const ERROR_CODES = {
  // auth
  EMAIL_TAKEN: "EMAIL_TAKEN",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  INVALID_REFRESH: "INVALID_REFRESH",
  TOKEN_REUSE_DETECTED: "TOKEN_REUSE_DETECTED",
  UNAUTHENTICATED: "UNAUTHENTICATED",

  // catalogue
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",

  // cart / checkout
  CART_EMPTY: "CART_EMPTY",
  OUT_OF_STOCK: "OUT_OF_STOCK",
  NOT_IN_CART: "NOT_IN_CART",
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",

  // generic
  VALIDATION_FAILED: "VALIDATION_FAILED",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Detail for an OUT_OF_STOCK failure, so the cart can show exactly which line
 * is the problem instead of a bare "something went wrong".
 */
export type OutOfStockField = {
  field: string;
  message: string;
};
