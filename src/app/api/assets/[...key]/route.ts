import { NextResponse, type NextRequest } from "next/server";
import { getStorage, PUBLIC_ASSET_KEY } from "@/lib/storage";

// Logos and signatures are referenced from public invoices, so they're served without a session.
// Keys are unguessable (144 random bits) and strictly pattern-checked, which also blocks path traversal.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const joined = key.join("/");
  if (!PUBLIC_ASSET_KEY.test(joined)) return new NextResponse("Not found", { status: 404 });
  const file = await getStorage().get(joined);
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.body.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
