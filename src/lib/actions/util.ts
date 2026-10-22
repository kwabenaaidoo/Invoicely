import { z } from "zod";
import { ServiceError } from "../services/common";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

export const fail = (error: string, fieldErrors?: Record<string, string>): { ok: false; error: string; fieldErrors?: Record<string, string> } => ({ ok: false, error, fieldErrors });

export function zodErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (key && !(key in out)) out[key] = issue.message;
  }
  return out;
}

export function invalid(err: z.ZodError) {
  return fail("Please fix the highlighted fields.", zodErrors(err));
}

/** Turn thrown service errors into form-friendly results; anything unexpected becomes a generic message. */
export function handle(err: unknown) {
  if (err instanceof ServiceError) {
    const details = Array.isArray(err.details) ? (err.details as { path: (string | number)[]; message: string }[]) : [];
    const fieldErrors = Object.fromEntries(details.map((d) => [d.path.join("."), d.message]));
    return fail(err.message, Object.keys(fieldErrors).length ? fieldErrors : undefined);
  }
  console.error(err);
  return fail("Something went wrong. Please try again.");
}
