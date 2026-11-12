import { PrismaClient } from "@prisma/client";

// Um único PrismaClient por processo (evita conexões extras no hot reload do Next.js).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
