import "server-only";
import dns from "node:dns/promises";
import net from "node:net";
import { after } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { decrypt, hmacSha256, randomToken, encrypt } from "./crypto";

/* ------------------------------ SSRF guard ------------------------------- */

function ipv4Private(ip: string) {
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return ipv4Private(ip);
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("::ffff:")) return ipv4Private(lower.slice(7));
  return lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb");
}

/** Webhook targets must be public HTTPS hosts, so a user can't aim deliveries at internal services. */
export async function assertPublicHttpsUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Webhook URLs must use https");
  if (url.username || url.password) throw new Error("Webhook URLs cannot contain credentials");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Webhook URL must be publicly reachable");
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) throw new Error("Webhook URL must be publicly reachable");
}

/* ------------------------------- signing --------------------------------- */

export function newWebhookSecret() {
  return `whsec_${randomToken(24)}`;
}
export const encryptSecret = encrypt;

/** Header format: `t=<unix seconds>,v1=<hex hmac of "<t>.<body>">` (receivers should reject stale timestamps). */
export function signPayload(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${hmacSha256(secret, `${timestamp}.${body}`)}`;
}

/* ------------------------------- delivery -------------------------------- */

const MAX_ATTEMPTS = 5;

export async function deliverEvent(eventId: string) {
  const event = await db.webhookEvent.findUnique({ where: { id: eventId }, include: { webhook: true } });
  if (!event) return;
  const body = JSON.stringify({ id: `evt_${event.id.replace(/-/g, "")}`, type: event.type, created: Math.floor(event.createdAt.getTime() / 1000), data: event.payload });

  let status: "SUCCESS" | "FAILED" = "FAILED";
  let responseCode: number | null = null;
  let error: string | null = null;

  try {
    await assertPublicHttpsUrl(event.webhook.url);
    const secret = decrypt(event.webhook.secretEncrypted);
    const res = await fetch(event.webhook.url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Invoicely-Webhooks/1.0",
        "Invoicely-Signature": signPayload(secret, body),
        "Invoicely-Event": event.type,
      },
      body,
    });
    responseCode = res.status;
    if (res.status >= 200 && res.status < 300) status = "SUCCESS";
    else error = `Endpoint responded with HTTP ${res.status}`;
  } catch (err) {
    error = err instanceof Error ? err.message.slice(0, 300) : "Delivery failed";
  }

  await db.webhookEvent.update({
    where: { id: event.id },
    data: { status, responseCode, error, attempts: { increment: 1 }, lastAttemptAt: new Date() },
  });
}

export async function retryEvent(eventId: string) {
  const event = await db.webhookEvent.findUnique({ where: { id: eventId } });
  if (!event || event.attempts >= MAX_ATTEMPTS + 5) return false;
  await deliverEvent(eventId);
  return true;
}

export type WebhookEventType = "invoice.created" | "invoice.updated" | "invoice.sent" | "invoice.paid" | "invoice.overdue" | "invoice.cancelled";

/** Queue + deliver an event to every enabled endpoint of the business that subscribed to it. */
export async function emitWebhook(businessId: string, type: WebhookEventType, data: Prisma.InputJsonValue) {
  const hooks = await db.webhook.findMany({ where: { businessId, enabled: true, events: { has: type } }, select: { id: true } });
  if (hooks.length === 0) return;
  const events = await Promise.all(hooks.map((h) => db.webhookEvent.create({ data: { webhookId: h.id, type, payload: data } })));
  const run = async () => {
    await Promise.allSettled(events.map((e) => deliverEvent(e.id)));
  };
  try {
    after(run);
  } catch {
    void run();
  }
}
