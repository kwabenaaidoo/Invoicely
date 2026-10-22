import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, getBusinessForUser } from "@/lib/auth/dal";
import { rateLimit } from "@/lib/rate-limit";
import { getInvoiceByPublicId, invoiceToView } from "@/lib/services/invoices";
import { renderInvoicePdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ ref: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await rateLimit(`pdf:${user.id}`, 30, 60);
  if (!rl.allowed) return NextResponse.json({ error: "Too many PDF requests. Try again in a minute." }, { status: 429 });

  const business = await getBusinessForUser(user.id);
  const { ref } = await ctx.params;
  const inv = await getInvoiceByPublicId(business.id, ref);
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdf = await renderInvoicePdf(invoiceToView(inv));
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${inv.number.replace(/[^A-Za-z0-9._-]/g, "_")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
