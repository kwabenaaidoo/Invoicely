"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, sha256 } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { clientMeta, createSession, currentSessionHash, destroyCurrentSession } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/dal";
import { forgotSchema, loginSchema, resetSchema, signupSchema } from "@/lib/validators";
import { fail, invalid, type ActionResult } from "./util";

const BCRYPT_COST = 12;
// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("invoicely-timing-equaliser", BCRYPT_COST);

const HOUR = 3600;

async function issueToken(userId: string, type: "EMAIL_VERIFICATION" | "PASSWORD_RESET", ttlMs: number) {
  const raw = randomToken(32);
  await db.verificationToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  await db.verificationToken.create({ data: { userId, type, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ttlMs) } });
  return raw;
}

export async function signup(input: unknown): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { name, email, password } = parsed.data;

  const { ip } = await clientMeta();
  const rl = await rateLimit(`signup:ip:${ip ?? "unknown"}`, 8, HOUR);
  if (!rl.allowed) return fail("Too many sign-up attempts. Please try again later.");

  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    return fail("Please fix the highlighted fields.", { email: "An account with this email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await db.user.create({
    data: {
      email,
      name,
      passwordHash,
      businesses: { create: { name: `${name.split(" ")[0]}'s Business`, email } },
    },
  });
  const token = await issueToken(user.id, "EMAIL_VERIFICATION", 24 * HOUR * 1000);
  await sendVerificationEmail(email, name, `${env.APP_URL}/verify-email?token=${token}`);
  await audit({ userId: user.id, action: "auth.signup", entity: "User", entityId: user.id, ipAddress: ip });
  await createSession(user.id, false);
  redirect("/dashboard");
}

export async function login(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { email, password, remember } = parsed.data;

  const { ip } = await clientMeta();
  const [byIp, byEmail] = await Promise.all([rateLimit(`login:ip:${ip ?? "unknown"}`, 30, 15 * 60), rateLimit(`login:email:${email}`, 8, 15 * 60)]);
  if (!byIp.allowed || !byEmail.allowed) return fail("Too many attempts. Please wait a few minutes and try again.");

  const user = await db.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.passwordHash || !ok) {
    await audit({ userId: user?.id, action: "auth.login_failed", entity: "User", entityId: user?.id, ipAddress: ip });
    return fail("Incorrect email or password.");
  }

  await createSession(user.id, !!remember);
  await audit({ userId: user.id, action: "auth.login", entity: "User", entityId: user.id, ipAddress: ip });
  redirect("/dashboard");
}

export async function logout() {
  const user = await getCurrentUser();
  await destroyCurrentSession();
  if (user) await audit({ userId: user.id, action: "auth.logout", entity: "User", entityId: user.id });
  redirect("/login");
}

export async function resendVerification(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in first.");
  if (user.emailVerified) return { ok: true };
  const rl = await rateLimit(`verify:${user.id}`, 3, HOUR);
  if (!rl.allowed) return fail("Please wait before requesting another email.");
  const token = await issueToken(user.id, "EMAIL_VERIFICATION", 24 * HOUR * 1000);
  await sendVerificationEmail(user.email, user.name, `${env.APP_URL}/verify-email?token=${token}`);
  return { ok: true };
}

/** Idempotent: an already-verified account also counts as success. */
export async function verifyEmailToken(raw: string): Promise<"verified" | "invalid"> {
  if (!raw || raw.length < 20) return "invalid";
  const token = await db.verificationToken.findUnique({ where: { tokenHash: sha256(raw) } });
  if (!token || token.type !== "EMAIL_VERIFICATION" || token.expiresAt < new Date()) return "invalid";
  if (!token.usedAt) {
    await db.$transaction([
      db.verificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      db.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: new Date() } }),
    ]);
    await audit({ userId: token.userId, action: "auth.email_verified", entity: "User", entityId: token.userId });
  }
  return "verified";
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = forgotSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { email } = parsed.data;
  const { ip } = await clientMeta();
  const [byIp, byEmail] = await Promise.all([rateLimit(`reset:ip:${ip ?? "unknown"}`, 10, HOUR), rateLimit(`reset:email:${email}`, 3, HOUR)]);
  if (!byIp.allowed || !byEmail.allowed) return fail("Too many requests. Please try again later.");

  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    const token = await issueToken(user.id, "PASSWORD_RESET", HOUR * 1000);
    await sendPasswordResetEmail(user.email, user.name, `${env.APP_URL}/reset-password?token=${token}`);
    await audit({ userId: user.id, action: "auth.reset_requested", entity: "User", entityId: user.id, ipAddress: ip });
  }
  // Same response whether or not the account exists (no account enumeration).
  return { ok: true };
}

export async function resetPassword(input: unknown): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { token: raw, password } = parsed.data;
  const { ip } = await clientMeta();
  const rl = await rateLimit(`reset-submit:ip:${ip ?? "unknown"}`, 15, HOUR);
  if (!rl.allowed) return fail("Too many attempts. Please try again later.");

  const token = await db.verificationToken.findUnique({ where: { tokenHash: sha256(raw) } });
  if (!token || token.type !== "PASSWORD_RESET" || token.usedAt || token.expiresAt < new Date()) {
    return fail("This reset link is invalid or has expired. Request a new one.");
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  await db.$transaction([
    db.verificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    db.user.update({ where: { id: token.userId }, data: { passwordHash, emailVerifiedAt: new Date() } }),
    // A password reset signs the user out everywhere.
    db.session.deleteMany({ where: { userId: token.userId } }),
  ]);
  await audit({ userId: token.userId, action: "auth.password_reset", entity: "User", entityId: token.userId, ipAddress: ip });
  return { ok: true };
}

export async function changePassword(input: unknown): Promise<ActionResult> {
  const { changePasswordSchema } = await import("@/lib/validators");
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in first.");
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const rl = await rateLimit(`chgpw:${user.id}`, 8, HOUR);
  if (!rl.allowed) return fail("Too many attempts. Please try again later.");
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!row.passwordHash || !(await bcrypt.compare(parsed.data.currentPassword, row.passwordHash))) {
    return fail("Please fix the highlighted fields.", { currentPassword: "Current password is incorrect" });
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_COST);
  const keep = await currentSessionHash();
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash } }),
    // Sign out every other device.
    db.session.deleteMany({ where: { userId: user.id, ...(keep ? { tokenHash: { not: keep } } : {}) } }),
  ]);
  await audit({ userId: user.id, action: "auth.password_changed", entity: "User", entityId: user.id });
  return { ok: true };
}
