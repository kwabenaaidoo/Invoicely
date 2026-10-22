import { api } from "@/lib/api/handler";
import { serializeInvoice } from "@/lib/api/invoices";
import { changeStatus, enableSharing, requireInvoice, sendInvoice } from "@/lib/services/invoices";

export const runtime = "nodejs";

/** Live keys email the client (when an address exists and email is configured). Test keys never send email. */
export const POST = api<{ id: string }>(async (ctx, { id }) => {
  const service = { businessId: ctx.businessId, userId: ctx.userId };
  if (ctx.mode === "TEST") {
    const inv = await requireInvoice(ctx.businessId, id);
    if (inv.status === "DRAFT") await changeStatus(service, id, "SENT");
    await enableSharing(service, id);
    return { data: { ...serializeInvoice(await requireInvoice(ctx.businessId, id)), emailed: false } };
  }
  const res = await sendInvoice(service, id);
  return { data: { ...serializeInvoice(await requireInvoice(ctx.businessId, id)), emailed: res.emailed } };
});
