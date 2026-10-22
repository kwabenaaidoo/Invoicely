import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { invoiceToView } from "@/lib/services/invoices";
import { renderInvoicePdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit(`pdf-public:${ip}`, 20, 60);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const inv = await db.invoice.findUnique({ where: { publicToken: token }, include: { items: { orderBy: { position: "asc" } } } });
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
