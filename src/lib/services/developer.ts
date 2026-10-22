import "server-only";
import { db } from "../db";
import { audit } from "../audit";
import { randomToken, sha256, encrypt, decrypt } from "../crypto";
import { assertPublicHttpsUrl, deliverEvent, newWebhookSecret, retryEvent } from "../webhooks";
import { PREFIX, ServiceError, fromPublicId, toPublicId } from "./common";
import type { Role } from "@/generated/prisma/client";

/* --------------------------------- access -------------------------------- */

/** "Request API access": in the MVP this is self-serve and instant. Swap for an approval queue later. */
export async function grantApiAccess(userId: string, role: Role) {
  if (role === "USER") {
    await db.user.update({ where: { id: userId }, data: { role: "DEVELOPER" } });
    await audit({ userId, action: "developer.access_granted", entity: "User", entityId: userId });
  }
}

/* -------------------------------- API keys -------------------------------- */

const SANDBOX_NAME = "Test mode sandbox";

/** Test keys run against a separate, hidden business so test data never mixes with live data. */
async function sandboxBusinessId(userId: string) {
  const existing = await db.business.findFirst({ where: { ownerId: userId, name: SANDBOX_NAME } });
  if (existing) return existing.id;
  const main = await db.business.findFirst({ where: { ownerId: userId, name: { not: SANDBOX_NAME } }, orderBy: { createdAt: "asc" } });
  const created = await db.business.create({
    data: { ownerId: userId, name: SANDBOX_NAME, defaultCurrency: main?.defaultCurrency ?? "USD", invoicePrefix: "TEST-" },
  });
  return created.id;
}

export type ApiKeyDTO = { id: string; name: string; mode: "TEST" | "LIVE"; publishable: string; last4: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };

function toDto(k: { name: string; mode: "TEST" | "LIVE"; publishable: string; secretLast4: string; createdAt: Date; lastUsedAt: Date | null; revokedAt: Date | null }): ApiKeyDTO {
  return { id: k.publishable, name: k.name, mode: k.mode, publishable: k.publishable, last4: k.secretLast4, createdAt: k.createdAt.toISOString(), lastUsedAt: k.lastUsedAt?.toISOString() ?? null, revokedAt: k.revokedAt?.toISOString() ?? null };
}

export async function listApiKeys(userId: string): Promise<ApiKeyDTO[]> {
  const rows = await db.apiKey.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return rows.map(toDto);
}

/** The full secret is returned exactly once. Only its SHA-256 digest is stored. */
export async function createApiKey(userId: string, businessId: string, name: string, mode: "TEST" | "LIVE") {
  const active = await db.apiKey.count({ where: { userId, revokedAt: null } });
  if (active >= 20) throw new ServiceError("CONFLICT", "You've reached the limit of 20 active API keys. Revoke one first.");
  const tag = mode === "LIVE" ? "live" : "test";
  const publishable = `pk_${tag}_${randomToken(15)}`;
  const secret = `sk_${tag}_${randomToken(32)}`;
  const targetBusiness = mode === "LIVE" ? businessId : await sandboxBusinessId(userId);
  const row = await db.apiKey.create({
    data: { userId, businessId: targetBusiness, name, mode, publishable, secretHash: sha256(secret), secretLast4: secret.slice(-4) },
  });
  await audit({ userId, action: "apikey.create", entity: "ApiKey", entityId: row.id, meta: { mode } });
  return { key: toDto(row), secret };
}

export async function revokeApiKey(userId: string, id: string) {
  const key = await db.apiKey.findFirst({ where: { publishable: id, userId } });
  if (!key) throw new ServiceError("NOT_FOUND", "API key not found");
  if (!key.revokedAt) await db.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });
  await audit({ userId, action: "apikey.revoke", entity: "ApiKey", entityId: key.id });
}

export async function regenerateApiKey(userId: string, businessId: string, id: string) {
  const key = await db.apiKey.findFirst({ where: { publishable: id, userId } });
  if (!key) throw new ServiceError("NOT_FOUND", "API key not found");
  await revokeApiKey(userId, id);
  return createApiKey(userId, businessId, key.name, key.mode);
}

export async function deleteApiKey(userId: string, id: string) {
  const key = await db.apiKey.findFirst({ where: { publishable: id, userId } });
  if (!key) throw new ServiceError("NOT_FOUND", "API key not found");
  if (!key.revokedAt) throw new ServiceError("CONFLICT", "Revoke a key before removing it");
  await db.apiKey.delete({ where: { id: key.id } });
}

/** Resolve a bearer secret to its key. Lookup is by digest (indexed, unique), so no plaintext comparison. */
export async function authenticateApiKey(secret: string) {
  if (!/^sk_(live|test)_[A-Za-z0-9_-]{20,80}$/.test(secret)) return null;
  const key = await db.apiKey.findUnique({ where: { secretHash: sha256(secret) }, include: { user: { select: { id: true, role: true } } } });
  if (!key || key.revokedAt) return null;
  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000) {
    void db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
  return key;
}

export async function recordApiRequest(apiKeyId: string, method: string, path: string, statusCode: number, durationMs: number) {
  try {
    await db.apiRequest.create({ data: { apiKeyId, method, path: path.slice(0, 200), statusCode, durationMs } });
  } catch (err) {
    console.error("api usage log failed", err);
  }
}

export async function apiUsage(userId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000);
  const where = { apiKey: { userId }, createdAt: { gte: since } };
  const [total, errors, daily, recent, byPath] = await Promise.all([
    db.apiRequest.count({ where }),
    db.apiRequest.count({ where: { ...where, statusCode: { gte: 400 } } }),
    db.$queryRaw<{ day: string; count: number; errors: number }[]>`
      SELECT to_char(date_trunc('day', r."createdAt"), 'YYYY-MM-DD') AS day, count(*)::int AS count,
             (count(*) FILTER (WHERE r."statusCode" >= 400))::int AS errors
      FROM "ApiRequest" r JOIN "ApiKey" k ON k.id = r."apiKeyId"
      WHERE k."userId" = ${userId}::uuid AND r."createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1`,
    db.apiRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 25, include: { apiKey: { select: { name: true, mode: true } } } }),
    db.apiRequest.groupBy({ by: ["method", "path"], where, _count: { _all: true }, orderBy: { _count: { path: "desc" } }, take: 6 }),
  ]);
  const series: { day: string; count: number; errors: number }[] = [];
  const map = new Map(daily.map((d) => [d.day, d]));
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
    series.push(map.get(day) ?? { day, count: 0, errors: 0 });
  }
  return {
    total,
    errors,
    series,
    top: byPath.map((p) => ({ method: p.method, path: p.path, count: p._count._all })),
    recent: recent.map((r) => ({ id: r.id, method: r.method, path: r.path, status: r.statusCode, ms: r.durationMs, at: r.createdAt.toISOString(), key: r.apiKey.name, mode: r.apiKey.mode })),
  };
}

/* -------------------------------- webhooks -------------------------------- */

export type WebhookDTO = { id: string; url: string; description: string | null; events: string[]; enabled: boolean; createdAt: string };
const whDto = (w: { publicId: string; url: string; description: string | null; events: string[]; enabled: boolean; createdAt: Date }): WebhookDTO => ({
  id: toPublicId(PREFIX.webhook, w.publicId), url: w.url, description: w.description, events: w.events, enabled: w.enabled, createdAt: w.createdAt.toISOString(),
});

export async function listWebhooks(businessId: string) {
  return (await db.webhook.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } })).map(whDto);
}

async function requireWebhook(businessId: string, ref: string) {
  const publicId = fromPublicId(PREFIX.webhook, ref);
  const w = publicId ? await db.webhook.findFirst({ where: { publicId, businessId } }) : null;
  if (!w) throw new ServiceError("NOT_FOUND", "Webhook endpoint not found");
  return w;
}

export async function createWebhook(userId: string, businessId: string, input: { url: string; description?: string; events: string[] }) {
  if ((await db.webhook.count({ where: { businessId } })) >= 10) throw new ServiceError("CONFLICT", "You can have up to 10 webhook endpoints");
  try {
    await assertPublicHttpsUrl(input.url);
  } catch (e) {
    throw new ServiceError("VALIDATION_ERROR", (e as Error).message, [{ path: ["url"], message: (e as Error).message }]);
  }
  const secret = newWebhookSecret();
  const w = await db.webhook.create({ data: { businessId, url: input.url, description: input.description ?? null, events: input.events, secretEncrypted: encrypt(secret) } });
  await audit({ userId, action: "webhook.create", entity: "Webhook", entityId: w.id });
  return { webhook: whDto(w), secret };
}

export async function setWebhookEnabled(userId: string, businessId: string, ref: string, enabled: boolean) {
  const w = await requireWebhook(businessId, ref);
  await db.webhook.update({ where: { id: w.id }, data: { enabled } });
  await audit({ userId, action: enabled ? "webhook.enable" : "webhook.disable", entity: "Webhook", entityId: w.id });
}

export async function deleteWebhook(userId: string, businessId: string, ref: string) {
  const w = await requireWebhook(businessId, ref);
  await db.webhook.delete({ where: { id: w.id } });
  await audit({ userId, action: "webhook.delete", entity: "Webhook", entityId: w.id });
}

export async function revealWebhookSecret(businessId: string, ref: string) {
  const w = await requireWebhook(businessId, ref);
  return decrypt(w.secretEncrypted);
}

export type WebhookEventDTO = { id: string; type: string; status: "PENDING" | "SUCCESS" | "FAILED"; attempts: number; responseCode: number | null; error: string | null; createdAt: string; endpoint: string };

export async function listWebhookEvents(businessId: string, take = 30): Promise<WebhookEventDTO[]> {
  const rows = await db.webhookEvent.findMany({ where: { webhook: { businessId } }, orderBy: { createdAt: "desc" }, take, include: { webhook: { select: { url: true } } } });
  return rows.map((e) => ({ id: e.id, type: e.type, status: e.status, attempts: e.attempts, responseCode: e.responseCode, error: e.error, createdAt: e.createdAt.toISOString(), endpoint: e.webhook.url }));
}

export async function retryWebhookEvent(businessId: string, eventId: string) {
  const ev = await db.webhookEvent.findFirst({ where: { id: eventId, webhook: { businessId } } });
  if (!ev) throw new ServiceError("NOT_FOUND", "Event not found");
  if (!(await retryEvent(ev.id))) throw new ServiceError("CONFLICT", "This event has reached its retry limit");
}

export async function sendTestWebhook(userId: string, businessId: string, ref: string) {
  const w = await requireWebhook(businessId, ref);
  const ev = await db.webhookEvent.create({ data: { webhookId: w.id, type: "invoice.updated", payload: { id: "inv_test", test: true, status: "draft" } } });
  await deliverEvent(ev.id);
  return db.webhookEvent.findUniqueOrThrow({ where: { id: ev.id } });
}
