import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "../env.js";
import { PrismaClient } from "../generated/prisma/client.js";

/**
 * Prisma 7 requires a driver adapter — there is no built-in connection layer
 * any more, and the datasource block in schema.prisma carries no URL.
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });

export async function assertDatabaseReachable(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
