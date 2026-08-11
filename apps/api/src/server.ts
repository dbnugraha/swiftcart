import { createApp } from "./app.js";
import { prisma } from "./db/prisma.js";
import { env } from "./env.js";
import { logger } from "./lib/logger.js";

const server = createApp().listen(env.PORT, env.HOST, () => {
  logger.info(`Swiftcart API listening on http://${env.HOST}:${env.PORT}`);
});

/**
 * Graceful shutdown: stop accepting connections, let in-flight requests finish,
 * then close the pool. Without this a redeploy can cut a checkout transaction
 * mid-flight.
 */
async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);

  server.close(async () => {
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  });

  // Don't hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});
