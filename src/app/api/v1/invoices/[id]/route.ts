import { db } from "@/lib/db";
import { api, readJson } from "@/lib/api/handler";
import { apiInvoiceBody, buildInvoiceInput, serializeInvoice } from "@/lib/api/invoices";
import { changeStatus, deleteInvoice, requireInvoice, updateInvoice } from "@/lib/services/invoices";
import { statusFromApi } from "@/lib/status";

export const runtime = "nodejs";
type P = { id: string };

export const GET = api<P>(async (ctx, { id }) => ({ data: serializeInvoice(await requireInvoice(ctx.businessId, id)) }));

export const PATCH = api<P>(async (ctx, { id }) => {
  const body = apiInvoiceBody.parse(await readJson(ctx.req));
  const service = { businessId: ctx.businessId, userId: ctx.userId };
  const existing = await requireInvoice(ctx.businessId, id);
  const { status, ...fields } = body;
  if (Object.keys(fields).length > 0) {
    const business = await db.business.findUniqueOrThrow({ where: { id: ctx.businessId } });
    await updateInvoice(service, id, await buildInvoiceInput(business, fields, existing));
  }
  const want = status ? statusFromApi(status) : null;
  if (want) await changeStatus(service, id, want);
  return { data: serializeInvoice(await requireInvoice(ctx.businessId, id)) };
});

export const DELETE = api<P>(async (ctx, { id }) => {
  await deleteInvoice({ businessId: ctx.businessId, userId: ctx.userId }, id);
  return { data: { id, deleted: true } };
});
