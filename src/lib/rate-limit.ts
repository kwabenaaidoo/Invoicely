import "server-only";
import { db } from "./db";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** epoch seconds when the current window ends */
  resetAt: number;
};

/**
 * Fixed-window counter stored in Postgres so limits hold across server instances.
 * One atomic upsert per check. Swap for Redis later behind the same signature.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const nowMs = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(nowMs / windowMs) * windowMs);

  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "windowStart", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key", "windowStart")
    DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
    RETURNING "count"`;

  const count = Number(rows[0]?.count ?? 1);

  // Opportunistic cleanup so the table stays small without a cron job.
  if (Math.random() < 0.01) {
    void db.rateLimitBucket
      .deleteMany({ where: { windowStart: { lt: new Date(nowMs - 24 * 3600 * 1000) } } })
      .catch(() => undefined);
  }

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt: Math.ceil((windowStart.getTime() + windowMs) / 1000),
  };
}
