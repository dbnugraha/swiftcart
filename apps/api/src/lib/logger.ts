import { pino } from "pino";

import { env, isProduction } from "../env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  // Pretty output in development only — production wants parseable JSON.
  transport: isProduction ? undefined : { target: "pino-pretty", options: { colorize: true } },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "req.body.refreshToken",
    ],
    censor: "[redacted]",
  },
});
