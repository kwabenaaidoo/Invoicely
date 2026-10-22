"use server";

import { db } from "../db";
import { invoiceSchema, statusSchema } from "../validators";
import { PREFIX, fromPublicId, toPublicId } from "../services/common";
import { changeStatus, createInvoice, deleteInvoice, duplicateInvoice, enableSharing, publicInvoiceUrl, revokeSharing, sendInvoice, updateInvoice } from "../services/invoices";
import { authed, writeBudget } from "./guard";
import { fail, handle, invalid, type ActionResult } from "./util";

type Raw = Record<string, unknown> & { clientId?: unknown; items?: unknown };

/** The browser only ever sees public ids (cli_…, prod_…). Map them to internal ids inside this tenant. */
async function resolveRefs(businessId: string, raw: unknown): Promise<Raw | null> {
  if (!raw || typeof raw !== "object") return null;
  const input = { ...(raw as Raw) };
  if (typeof input.clientId === "string" && input.clientId) {
    const pid = fromPublicId(PREFIX.client, input.clientId);
    const client = pid ? await db.client.findFirst({ where: { publicId: pid, businessId }, select: { id: true } }) : null;
    if (!client) return null;
    input.clientId = client.id;
  } else {
    input.clientId = null;
  }
  if (Array.isArray(input.items)) {
    const refs = new Set<string>();
    for (const it of input.items as Raw[]) if (typeof it?.productId === "string" && it.productId) refs.add(it.productId);
    const pids = [...refs].map((r) => fromPublicId(PREFIX.product, r)).filter((x): x is string => !!x);
    const rows = pids.length ? await db.product.findMany({ where: { businessId, publicId: { in: pids } }, select: { id: true, publicId: true } }) : [];
    const map = new Map(rows.map((r) => [toPublicId(PREFIX.product, r.publicId), r.id]));
    input.items = (input.items as Raw[]).map((it) => ({ ...it, productId: typeof it.productId === "string" ? (map.get(it.productId) ?? null) : null }));
  }
  return input;
}

export async function saveInvoiceAction(ref: string | null, input: unknown): Promise<ActionResult<{ ref: string }>> {
  const { ctx } = await authed();
  const limited = await writeBudget(ctx.userId);
  if (limited) return limited;
  const resolved = await resolveRefs(ctx.businessId, input);
  if (!resolved) return fail("Please fix the highlighted fields.", { clientId: "Client not found" });
  const parsed = invoiceSchema.safeParse(resolved);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const inv = ref ? await updateInvoice(ctx, ref, parsed.data) : await createInvoice(ctx, parsed.data);
    return { ok: true, data: { ref: toPublicId(PREFIX.invoice, inv.publicId) } };
  } catch (e) {
    return handle(e);
  }
}

export async function setStatusAction(ref: string, status: string): Promise<ActionResult> {
  const { ctx } = await authed();
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return fail("Unknown status");
  try {
    await changeStatus(ctx, ref, parsed.data);
    return { ok: true };
  } catch (e) {
    return handle(e);
  }
}

export async function duplicateInvoiceAction(ref: string): Promise<ActionResult<{ ref: string }>> {
  const { ctx } = await authed();
  const limited = await writeBudget(ctx.userId);
  if (limited) return limited;
  try {
    const inv = await duplicateInvoice(ctx, ref);
    return { ok: true, data: { ref: toPublicId(PREFIX.invoice, inv.publicId) } };
  } catch (e) {
    return handle(e);
  }
}

export async function deleteInvoiceAction(ref: string): Promise<ActionResult> {
  const { ctx } = await authed();
  try {
    await deleteInvoice(ctx, ref);
    return { ok: true };
  } catch (e) {
    return handle(e);
  }
}

export async function shareInvoiceAction(ref: string): Promise<ActionResult<{ url: string }>> {
  const { ctx } = await authed();
  try {
    const inv = await enableSharing(ctx, ref);
    return { ok: true, data: { url: publicInvoiceUrl(inv.publicToken!) } };
  } catch (e) {
    return handle(e);
  }
}

export async function revokeShareAction(ref: string): Promise<ActionResult> {
  const { ctx } = await authed();
  try {
    await revokeSharing(ctx, ref);
    return { ok: true };
  } catch (e) {
    return handle(e);
  }
}

export async function sendInvoiceAction(ref: string): Promise<ActionResult<{ url: string; emailed: boolean }>> {
  const { ctx } = await authed();
  try {
    const res = await sendInvoice(ctx, ref);
    return { ok: true, data: { url: res.url, emailed: res.emailed } };
  } catch (e) {
    return handle(e);
  }
}
