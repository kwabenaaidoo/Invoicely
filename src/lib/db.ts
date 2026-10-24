import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

const globalForPrisma = globalThis as unknown as {
  prisma?: InstanceType<typeof PrismaClient>;
};

function create() {
  const ca = process.env.SUPABASE_CA_CERT;

  if (!ca) {
    throw new Error("SUPABASE_CA_CERT is required");
  }

  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    ssl: {
      ca,
      rejectUnauthorized: true,
    },
  });

  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? create();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export type Db = typeof db;
