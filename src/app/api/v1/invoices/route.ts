import { z } from "zod";
import { db } from "@/lib/db";
import { api, pageMeta, readJson } from "@/lib/api/handler";
import { apiInvoiceBody, buildInvoiceInput, serializeInvoice } from "@/lib/api/invoices";
import { changeStatus, createInvoice, listInvoices, requireInvoice } from "@/lib/services/invoices";
import { PREFIX, fromPublicId, toPublicId } from "@/lib/services/common";
import { statusFromApi } from "@/lib/status";
import { listQuery } from "@/lib/validators";

export const runtime = "nodejs";

export const GET = api(async (ctx) => {
  const sp = Object.fromEntries(new URL(ctx.req.url).searchParams);
  const { page, pageSize } = listQuery.parse(sp);
  const status = sp.status ? statusFromApi(sp.status) : null;
  let clientId: string | undefined;
  if (sp.clientId) {
    const pid = fromPublicId(PREFIX.client, sp.clientId);
    clientId = pid ? (await db.client.findFirst({ where: { publicId: pid, businessId: ctx.businessId }, select: { id: true } }))?.id : undefined;
    if (!clientId) return { data: [], meta: pageMeta(page, pageSize, 0) };
  }
  const res = await listInvoices(ctx.businessId, { page, pageSize, q: sp.q, status: status ?? undefined, clientId, sort: "createdAt", dir: "desc" });
  const full = await db.invoice.findMany({ where: { id: { in: res.rows.map((r) => r.id) } }, include: { items: { orderBy: { position: "asc" } }, client: { select: { publicId: true, name: true } }, payments: true } });
  const byId = new Map(full.map((f) => [f.id, f]));
  return { data: res.rows.map((r) => serializeInvoice(byId.get(r.id)!)), meta: pageMeta(res.page, res.pageSize, res.total) };
});

export const POST = api(async (ctx) => {
  const body = apiInvoiceBody.parse(await readJson(ctx.req));
  if (!body.items) return Promise.reject(new z.ZodError([{ code: "custom", path: ["items"], message: "items is required", input: undefined }]));
  const business = await db.business.findUniqueOrThrow({ where: { id: ctx.businessId } });
  const input = await buildInvoiceInput(business, body);
  const inv = await createInvoice({ businessId: ctx.businessId, userId: ctx.userId }, input);
  const ref = toPublicId(PREFIX.invoice, inv.publicId);
  const want = body.status ? statusFromApi(body.status) : null;
  if (want && want !== "DRAFT") await changeStatus({ businessId: ctx.businessId, userId: ctx.userId }, ref, want);
  return { data: serializeInvoice(await requireInvoice(ctx.businessId, ref)), status: 201 };
});
