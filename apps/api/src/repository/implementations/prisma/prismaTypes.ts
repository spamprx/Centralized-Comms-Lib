import type { Prisma, PrismaClient } from "@prisma/client";

export type PrismaDb = PrismaClient | Prisma.TransactionClient;

export type PrismaTx = Prisma.TransactionClient;
