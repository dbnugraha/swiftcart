// Prisma 7 no longer auto-loads .env, and CLI configuration moved out of
// schema.prisma into this file. Without the dotenv import, `prisma migrate`
// cannot see DATABASE_URL.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
