import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { db } from "../db";
import { isProd } from "../env";
import { randomToken, sha256 } from "../crypto";

// `__Host-` pins the cookie to this exact origin over HTTPS (no Domain, Path=/, Secure).
const COOKIE = isProd ? "__Host-inv_session" : "inv_session";
const DAY = 24 * 60 * 60 * 1000;
const SHORT_TTL = 7 * DAY;
const LONG_TTL = 30 * DAY;

export async function clientMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwarded || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
  };
}

export async function createSession(userId: string, remember: boolean) {
  const token = randomToken(32);
  const ttl = remember ? LONG_TTL : SHORT_TTL;
  const { ip, userAgent } = await clientMeta();
  const session = await db.session.create({
    data: { userId, tokenHash: sha256(token), remember, ipAddress: ip, userAgent, expiresAt: new Date(Date.now() + ttl) },
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ttl / 1000),
  });
  return session;
}

/** Resolve the current session (memoised per request). Returns null when absent/expired. */
export const getSession = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session;
});

/** Called from server actions / route handlers only (cookies are read-only while rendering). */
export async function touchSession(sessionId: string, remember: boolean) {
  const ttl = remember ? LONG_TTL : SHORT_TTL;
  await db.session.update({
    where: { id: sessionId },
    data: { lastUsedAt: new Date(), expiresAt: new Date(Date.now() + ttl) },
  });
}

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(COOKIE);
}

export async function currentSessionHash() {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? sha256(token) : null;
}

export const SESSION_COOKIE_NAME = COOKIE;
