import { api, pageMeta, readJson } from "@/lib/api/handler";
import { clientSchema, listQuery } from "@/lib/validators";
import { createClient, listClients, serializeClient } from "@/lib/services/clients";

export const runtime = "nodejs";

export const GET = api(async (ctx) => {
  const sp = Object.fromEntries(new URL(ctx.req.url).searchParams);
  const { page, pageSize } = listQuery.parse(sp);
  const res = await listClients(ctx.businessId, { q: sp.q, page, pageSize });
  return { data: res.rows.map(serializeClient), meta: pageMeta(res.page, res.pageSize, res.total) };
});

export const POST = api(async (ctx) => {
  const input = clientSchema.strict().parse(await readJson(ctx.req));
  return { data: serializeClient(await createClient({ businessId: ctx.businessId, userId: ctx.userId }, input)), status: 201 };
});
