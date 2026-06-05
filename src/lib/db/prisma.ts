import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Alias temporário pro cliente sem soft-delete filtering (lixeira #59).
 * Por enquanto reusa a mesma instância — quando a extension de soft-delete
 * for adicionada, este export deve apontar pra `new PrismaClient()` cru.
 */
export const prismaRaw = prisma;
