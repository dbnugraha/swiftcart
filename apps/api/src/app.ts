import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { env } from "./env.js";
import { logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { health, v1 } from "./routes.js";

export function createApp() {
  const app = express();

  // Behind a proxy in any real deployment; without this the rate limiter keys
  // every request to the proxy's IP and throttles all users as one.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((o) => o.trim()),
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(pinoHttp({ logger }));

  app.use(health);
  app.use("/v1", v1);

  // Order matters: unmatched routes first, then the error handler last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
