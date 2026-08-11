import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

import { ERROR_CODES } from "@swiftcart/shared";

import { isProduction } from "../env.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

/**
 * The single place a response is chosen for a thrown value.
 *
 * Express 5 forwards rejected promises from async handlers here automatically,
 * so routes can simply throw and every failure lands in one shape.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    // Expected, already-shaped failures. Logged at warn — they are the API
    // working correctly, not an incident.
    logger.warn({ code: error.code, status: error.status }, error.message);
    res.status(error.status).json(error.toJSON());
    return;
  }

  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: ERROR_CODES.VALIDATION_FAILED,
        message: "Some fields need attention.",
        fields: error.issues.map((issue) => ({
          field: issue.path.join(".") || "(body)",
          message: issue.message,
        })),
      },
    });
    return;
  }

  // Anything reaching here is a bug. Log it whole, tell the client nothing:
  // stack traces and driver messages leak schema and dependency detail.
  logger.error({ err: error }, "Unhandled error");

  res.status(500).json({
    error: {
      code: ERROR_CODES.INTERNAL,
      message: "Something went wrong on our end.",
      ...(isProduction
        ? {}
        : { detail: error instanceof Error ? error.message : String(error) }),
    },
  });
};

/** Terminal 404 for unmatched routes, in the same envelope as everything else. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: { code: ERROR_CODES.NOT_FOUND, message: "No such endpoint." },
  });
};
