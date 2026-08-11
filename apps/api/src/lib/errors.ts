import { ERROR_CODES, type ErrorCode } from "@swiftcart/shared";

/**
 * One error envelope for the whole API:
 *
 *   { "error": { "code", "message", "fields": [{ "field", "message" }] } }
 *
 * `code` is the contract the client switches on; `message` is for humans and
 * may change freely. `fields` lets a form highlight the offending input
 * instead of showing one generic banner.
 */

export type FieldError = { field: string; message: string };

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | string,
    message: string,
    readonly fields?: FieldError[],
  ) {
    super(message);
    this.name = "AppError";
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
      },
    };
  }
}

export const badRequest = (code: string, message: string, fields?: FieldError[]) =>
  new AppError(400, code, message, fields);

export const unauthorized = (code: string, message: string) =>
  new AppError(401, code, message);

/**
 * Used for "not yours" as well as "not there". Returning 403 for a resource
 * owned by someone else confirms it exists; 404 leaks nothing.
 */
export const notFound = (
  code: string = ERROR_CODES.NOT_FOUND,
  message = "Not found.",
) => new AppError(404, code, message);

export const conflict = (code: string, message: string, fields?: FieldError[]) =>
  new AppError(409, code, message, fields);

export const unprocessable = (code: string, message: string, fields?: FieldError[]) =>
  new AppError(422, code, message, fields);
