import { api } from "@/lib/api/handler";
import { invoiceToView, requireInvoice } from "@/lib/services/invoices";
import { renderInvoicePdf } from "@/lib/pdf";
import { rateLimit } from "@/lib/rate-limit";
import { ServiceError } from "@/lib/services/common";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = api<{ id: string }>(async (ctx, { id }) => {
  // PDF rendering is expensive: stricter per-key budget on top of the global API limit.
  const rl = await rateLimit(`api-pdf:${ctx.keyId}`, 20, 60);
  if (!rl.allowed) throw new ServiceError("RATE_LIMITED", "PDF rate limit exceeded (20 per minute).");
  const inv = await requireInvoice(ctx.businessId, id);
  const pdf = await renderInvoicePdf(invoiceToView(inv));
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${inv.number.replace(/[^A-Za-z0-9._-]/g, "_")}.pdf"`, "Cache-Control": "no-store" },
  });
});
