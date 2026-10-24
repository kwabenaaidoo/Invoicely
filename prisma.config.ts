import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres.jrrxxljkvwujuvdr:%40AcT1v1Ty1%24%25%23@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require",
  },
});
