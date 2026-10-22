import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authenticateApiKey, recordApiRequest } from "../services/developer";
import { rateLimit } from "../rate-limit";
import { ServiceError, type ServiceErrorCode } from "../services/common";

export type ApiCtx = { businessId: string; userId: string; keyId: string; mode: "TEST" | "LIVE"; req: NextRequest };

type Json = Record<string, unknown> | unknown[] | null;
export type ApiResult = { data: Json; status?: number; meta?: Record<string, unknown> } | Response;

const RATE = { LIVE: { limit: 120, window: 60 }, TEST: { limit: 60, window: 60 } } as const;

export function errorBody(code: ServiceErrorCode | "BAD_REQUEST" | "METHOD_NOT_ALLOWED", message: string, details?: unknown) {
  return { success: false as const, error: { code, message, ...(details !== undefined ? { details } : {}) } };
}

function headers(extra: Record<string, string> = {}) {
  return { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra };
}

/** Parse a JSON body once, with a size cap. Throws a ServiceError so handlers stay linear. */
export async function readJson(req: NextRequest, maxBytes = 256 * 1024): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new ServiceError("VALIDATION_ERROR", "Request body is too large");
  const text = await req.text();
  if (text.length > maxBytes) throw new ServiceError("VALIDATION_ERROR", "Request body is too large");
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ServiceError("VALIDATION_ERROR", "Request body must be valid JSON");
  }
}

export function zodDetails(err: z.ZodError) {
  return err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

/** Authentication, rate limiting, error mapping and usage logging for every /api/v1 route. */
export function api<P = Record<string, string>>(handler: (ctx: ApiCtx, params: P) => Promise<ApiResult>) {
  return async (req: NextRequest, route: { params: Promise<P> }): Promise<Response> => {
    const started = Date.now();
    let keyId: string | null = null;
    let res: Response;
    let rl: Awaited<ReturnType<typeof rateLimit>> | null = null;
    try {
      const auth = req.headers.get("authorization") ?? "";
      const m = /^Bearer\s+(\S+)$/i.exec(auth);
      const key = m ? await authenticateApiKey(m[1]!) : null;
      if (!key) {
        res = NextResponse.json(errorBody("UNAUTHORIZED", "Missing or invalid API key. Send your secret key as 'Authorization: Bearer sk_…'."), { status: 401, headers: headers({ "WWW-Authenticate": 'Bearer realm="invoicely"' }) });
        return res;
      }
      keyId = key.id;
      const cfg = RATE[key.mode];
      rl = await rateLimit(`api:${key.id}`, cfg.limit, cfg.window);
      if (!rl.allowed) {
        res = NextResponse.json(errorBody("RATE_LIMITED", "Rate limit exceeded. Retry after the time in the Retry-After header."), {
          status: 429,
          headers: headers({ "Retry-After": String(Math.max(1, rl.resetAt - Math.floor(Date.now() / 1000))) }),
        });
      } else {
        const out = await handler({ businessId: key.businessId, userId: key.userId, keyId: key.id, mode: key.mode, req }, await route.params);
        if (out instanceof Response) res = out;
        else
          res = NextResponse.json({ success: true, data: out.data, livemode: key.mode === "LIVE", ...(out.meta ? { meta: out.meta } : {}) }, { status: out.status ?? 200, headers: headers() });
      }
    } catch (err) {
      if (err instanceof ServiceError) {
        res = NextResponse.json(errorBody(err.code, err.message, err.details), { status: err.status, headers: headers() });
      } else if (err instanceof z.ZodError) {
        res = NextResponse.json(errorBody("VALIDATION_ERROR", "Invalid request data", zodDetails(err)), { status: 422, headers: headers() });
      } else {
        console.error("api error", err);
        res = NextResponse.json(errorBody("INTERNAL", "Something went wrong on our side. Please try again."), { status: 500, headers: headers() });
      }
    }
    if (rl) {
      res.headers.set("X-RateLimit-Limit", String(rl.limit));
      res.headers.set("X-RateLimit-Remaining", String(rl.remaining));
      res.headers.set("X-RateLimit-Reset", String(rl.resetAt));
    }
    if (keyId) void recordApiRequest(keyId, req.method, new URL(req.url).pathname, res.status, Date.now() - started);
    return res;
  };
}

export function pageMeta(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) };
}
