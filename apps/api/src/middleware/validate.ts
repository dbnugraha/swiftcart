import type { RequestHandler, Response } from "express";
import type { ZodType } from "zod";

/**
 * Body and query validation.
 *
 * Both replace the raw input with the PARSED value, so downstream handlers get
 * coerced, defaulted, trimmed data rather than strings. Query results go on
 * `res.locals` because Express 5 makes `req.query` a getter that cannot be
 * reassigned.
 */

export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);

    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(result.error);

    res.locals.query = result.data;
    next();
  };
}

export function parsedQuery<T>(res: Response): T {
  return res.locals.query as T;
}

/**
 * Express 5 types a path param as `string | string[] | undefined`. Routes only
 * ever declare single params, so this narrows once instead of at every call.
 */
export function pathParam(params: Record<string, unknown>, name: string): string {
  const value = params[name];
  return typeof value === "string" ? value : "";
}
