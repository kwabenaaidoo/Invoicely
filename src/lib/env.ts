import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  /** 32 random bytes, base64 or hex. Used to encrypt webhook signing secrets at rest. */
  ENCRYPTION_KEY: z.string().optional(),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_DIR: z.string().default(".data/uploads"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Invoicely <no-reply@localhost>"),
  /** Path to a Chrome/Chromium binary. If unset, @sparticuz/chromium is used. */
  CHROMIUM_PATH: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
}

export const env = parsed.data;

if (env.NODE_ENV === "production" && !env.ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY is required in production");
}
if (env.STORAGE_DRIVER === "s3" && (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY)) {
  throw new Error("S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required when STORAGE_DRIVER=s3");
}

export const isProd = env.NODE_ENV === "production";
