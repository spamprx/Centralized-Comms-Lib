import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === "") {
    throw new Error(
      "DATABASE_URL environment variable is not set. Set it in .env or your container environment.",
    );
  }
  return new PrismaClient({ datasources: { db: { url } } });
}

export function getPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV !== "production") {
    if (!globalThis.__prisma) globalThis.__prisma = createPrismaClient();
    return globalThis.__prisma;
  }

  return createPrismaClient();
}

