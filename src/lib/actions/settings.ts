"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "../db";
import { audit } from "../audit";
import { env } from "../env";
import { randomToken, sha256 } from "../crypto";
import { sendVerificationEmail } from "../email";
import { rateLimit } from "../rate-limit";
import { businessSchema, invoiceSettingsSchema, profileSchema } from "../validators";
import { destroyCurrentSession, currentSessionHash } from "../auth/session";
import { getStorage, saveImage, UploadError } from "../storage";
import { authed } from "./guard";
import { fail, handle, invalid, type ActionResult } from "./util";

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const { user } = await authed();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { name, email } = parsed.data;
  try {
    const changed = email !== user.email;
    if (changed) {
      const taken = await db.user.findUnique({ where: { email }, select: { id: true } });
      if (taken) return fail("Please fix the highlighted fields.", { email: "An account with this email already exists" });
    }
    await db.user.update({ where: { id: user.id }, data: { name, ...(changed ? { email, emailVerifiedAt: null } : {}) } });
    if (changed) {
      const raw = randomToken(32);
      await db.verificationToken.create({ data: { userId: user.id, type: "EMAIL_VERIFICATION", tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 86400_000) } });
      await sendVerificationEmail(email, name, `${env.APP_URL}/verify-email?token=${raw}`);
    }
    await audit({ userId: user.id, action: "profile.update", entity: "User", entityId: user.id });
    return { ok: true };
  } catch (e) {
    return handle(e);
  }
}

export async function updateBusinessAction(input: unknown): Promise<ActionResult> {
  const { ctx } = await authed();
  const parsed = businessSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  try {
    await db.business.update({
      where: { id: ctx.businessId },
      data: {
        name: d.name, email: d.email ?? null, phone: d.phone ?? null, website: d.website ?? null, taxId: d.taxId ?? null,
        addressLine1: d.addressLine1 ?? null, addressLine2: d.addressLine2 ?? null, city: d.city ?? null, region: d.region ?? null,
        postalCode: d.postalCode ?? null, country: d.country ?? null, paymentInfo: d.paymentInfo ?? null,
      },
    });
    await audit({ userId: ctx.userId, action: "business.update", entity: "Business", entityId: ctx.businessId });
    return { ok: true };
  } catch (e) {
    return handle(e);
  }
}

export async function updateInvoiceSettingsAction(input: unknown): Promise<ActionResult> {
  const { ctx } = await authed();
  const parsed = invoiceSettingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  try {
    await db.business.update({
      where: { id: ctx.businessId },
      data: {
        defaultCurrency: d.defaultCurrency, invoicePrefix: d.invoicePrefix, invoiceNumberPadding: d.invoiceNumberPadding, nextInvoiceNumber: d.nextInvoiceNumber,
        defaultPaymentTerms: d.defaultPaymentTerms, defaultTaxRate: String(d.defaultTaxRate), defaultNotes: d.defaultNotes ?? null, defaultFooter: d.defaultFooter ?? null,
      },
    });
    await audit({ userId: ctx.userId, action: "business.invoice_settings", entity: "Business", entityId: ctx.businessId });
    return { ok: true };
  } catch (e) {
    return handle(e);
  }
}

async function uploadImage(kind: "logos" | "signatures", formData: FormData): Promise<ActionResult> {
  const { ctx, business } = await authed();
  const rl = await rateLimit(`upload:${ctx.userId}`, 20, 3600);
  if (!rl.allowed) return fail("Too many uploads. Please try again later.");
  const file = formData.get("file");
  if (!(file instanceof File)) return fail("Choose an image to upload.");
  try {
    const key = await saveImage(kind, ctx.businessId, file);
    const field = kind === "logos" ? "logoKey" : "signatureKey";
    const old = business[field];
    await db.business.update({ where: { id: ctx.businessId }, data: { [field]: key } });
    if (old) await getStorage().delete(old).catch(() => undefined);
    await audit({ userId: ctx.userId, action: `business.${kind}_upload`, entity: "Business", entityId: ctx.businessId });
    return { ok: true };
  } catch (e) {
    if (e instanceof UploadError) return fail(e.message);
    return handle(e);
  }
}

export async function uploadLogoAction(formData: FormData) {
  return uploadImage("logos", formData);
}
export async function uploadSignatureAction(formData: FormData) {
  return uploadImage("signatures", formData);
}

export async function removeImageAction(kind: "logos" | "signatures"): Promise<ActionResult> {
  const { ctx, business } = await authed();
  const field = kind === "logos" ? "logoKey" : "signatureKey";
  const old = business[field];
  await db.business.update({ where: { id: ctx.businessId }, data: { [field]: null } });
  if (old) await getStorage().delete(old).catch(() => undefined);
  return { ok: true };
}

export async function revokeSessionAction(id: string): Promise<ActionResult> {
  const { user } = await authed();
  await db.session.deleteMany({ where: { id, userId: user.id } });
  return { ok: true };
}

export async function revokeOtherSessionsAction(): Promise<ActionResult> {
  const { user } = await authed();
  const keep = await currentSessionHash();
  await db.session.deleteMany({ where: { userId: user.id, ...(keep ? { tokenHash: { not: keep } } : {}) } });
  await audit({ userId: user.id, action: "auth.sessions_revoked", entity: "User", entityId: user.id });
  return { ok: true };
}

export async function deleteAccountAction(input: { password: string; confirm: string }): Promise<ActionResult> {
  const { user } = await authed();
  if (input?.confirm !== "DELETE") return fail("Please fix the highlighted fields.", { confirm: "Type DELETE to confirm" });
  const rl = await rateLimit(`delete-account:${user.id}`, 5, 3600);
  if (!rl.allowed) return fail("Too many attempts. Please try again later.");
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!row.passwordHash || !(await bcrypt.compare(input.password ?? "", row.passwordHash))) {
    return fail("Please fix the highlighted fields.", { password: "Password is incorrect" });
  }
  const businesses = await db.business.findMany({ where: { ownerId: user.id }, select: { logoKey: true, signatureKey: true } });
  await audit({ userId: user.id, action: "account.delete", entity: "User", entityId: user.id });
  await db.user.delete({ where: { id: user.id } });
  for (const b of businesses) for (const k of [b.logoKey, b.signatureKey]) if (k) await getStorage().delete(k).catch(() => undefined);
  await destroyCurrentSession();
  redirect("/");
}

export async function markNotificationsReadAction(): Promise<ActionResult> {
  const { user } = await authed();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return { ok: true };
}
