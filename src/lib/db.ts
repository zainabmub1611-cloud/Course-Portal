import { PrismaClient } from "@prisma/client";
import { createMockPrisma } from "@/lib/mock-prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  mockWarned?: boolean;
};

function initDb(): PrismaClient {
  if (process.env.DATABASE_URL) {
    try {
      return new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
      });
    } catch (err) {
      console.warn("[AI Studio] Failed to initialize PrismaClient, using in-memory fallback:", err);
    }
  }
  if (!globalForPrisma.mockWarned) {
    console.warn("[AI Studio] DATABASE_URL not configured — using pre-seeded in-memory database");
    globalForPrisma.mockWarned = true;
  }
  return createMockPrisma();
}

export const db: PrismaClient = globalForPrisma.prisma ?? initDb();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export function isRealDatabase(): boolean {
  return (
    Boolean(process.env.DATABASE_URL) &&
    typeof (db as unknown as { $executeRawUnsafe?: unknown }).$executeRawUnsafe === "function"
  );
}

