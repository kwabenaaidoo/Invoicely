import { api, pageMeta, readJson } from "@/lib/api/handler";
import { listQuery, productSchema } from "@/lib/validators";
import { createProduct, listProducts, serializeProduct } from "@/lib/services/products";

export const runtime = "nodejs";

export const GET = api(async (ctx) => {
  const sp = Object.fromEntries(new URL(ctx.req.url).searchParams);
  const { page, pageSize } = listQuery.parse(sp);
  const res = await listProducts(ctx.businessId, { q: sp.q, page, pageSize });
  return { data: res.rows.map(serializeProduct), meta: pageMeta(res.page, res.pageSize, res.total) };
});

export const POST = api(async (ctx) => {
  const input = productSchema.strict().parse(await readJson(ctx.req));
  return { data: serializeProduct(await createProduct({ businessId: ctx.businessId, userId: ctx.userId }, input)), status: 201 };
});
