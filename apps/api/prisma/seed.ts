/**
 * Seeds the catalogue from DummyJSON, and a demo account to sign in with.
 *
 * The fetch happens ONCE, here — the running API never calls a third party.
 * That keeps the demo working offline and, more importantly, lets stock be
 * ours to decrement at checkout, which a read-only upstream could never allow.
 *
 *   npm run seed --workspace @swiftcart/api
 *
 * Re-running is safe: products upsert on their source id.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import { toCents } from "@swiftcart/shared";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { hashPassword } from "../src/lib/password.js";

const SOURCE = "https://dummyjson.com/products?limit=0";

const DEMO_EMAIL = "demo@swiftcart.test";
const DEMO_PASSWORD = "swiftcart123";

type SourceProduct = {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  tags: string[];
  brand?: string;
  sku: string;
  thumbnail: string;
  images: string[];
  reviews?: {
    rating: number;
    comment: string;
    date: string;
    reviewerName: string;
  }[];
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function fetchProducts(): Promise<SourceProduct[]> {
  const response = await fetch(SOURCE);

  if (!response.ok) {
    throw new Error(
      `Could not reach DummyJSON (${response.status}). Seeding needs network access once.`,
    );
  }

  const body = (await response.json()) as { products?: SourceProduct[] };

  if (!Array.isArray(body.products) || body.products.length === 0) {
    throw new Error("DummyJSON returned no products — aborting rather than seeding an empty shop.");
  }

  return body.products;
}

async function main() {
  console.log("Fetching catalogue…");
  const products = await fetchProducts();
  console.log(`  ${products.length} products`);

  let created = 0;
  let updated = 0;

  for (const source of products) {
    const data = {
      sku: source.sku,
      title: source.title,
      description: source.description,
      category: source.category,
      brand: source.brand ?? null,
      // Integer cents from the very first moment the number enters the system.
      priceCents: toCents(source.price),
      discountPercentage: source.discountPercentage,
      rating: source.rating,
      // Bumped so the demo doesn't run dry after a few checkouts.
      stock: Math.max(source.stock, 25),
      thumbnail: source.thumbnail,
      images: source.images ?? [],
      tags: source.tags ?? [],
    };

    const existing = await prisma.product.findUnique({
      where: { externalId: source.id },
      select: { id: true },
    });

    const product = await prisma.product.upsert({
      where: { externalId: source.id },
      create: { externalId: source.id, ...data },
      update: data,
    });

    if (existing) updated += 1;
    else created += 1;

    // Replaced wholesale rather than merged — reviews have no stable upstream
    // id, so matching them would be guesswork.
    await prisma.review.deleteMany({ where: { productId: product.id } });

    if (source.reviews?.length) {
      await prisma.review.createMany({
        data: source.reviews.map((review) => ({
          productId: product.id,
          rating: review.rating,
          comment: review.comment,
          reviewerName: review.reviewerName,
          createdAt: new Date(review.date),
        })),
      });
    }
  }

  console.log(`  ${created} created, ${updated} updated`);

  const categories = await prisma.product.groupBy({ by: ["category"] });
  console.log(`  ${categories.length} categories`);

  const demo = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      name: "Demo Shopper",
      passwordHash: await hashPassword(DEMO_PASSWORD),
    },
    update: {},
  });

  console.log(`\nDemo account: ${demo.email} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
