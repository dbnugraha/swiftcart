const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Guards every id that reaches a `where` clause.
 *
 * Postgres rejects a malformed uuid at the driver level, so without this a
 * request for `/products/banana` becomes a 500 with a driver message rather
 * than a clean 404.
 */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
