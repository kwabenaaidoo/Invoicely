"use server";

import { apiKeySchema, webhookSchema } from "../validators";
import { createApiKey, createWebhook, deleteApiKey, deleteWebhook, grantApiAccess, regenerateApiKey, retryWebhookEvent, revealWebhookSecret, revokeApiKey, sendTestWebhook, setWebhookEnabled, type ApiKeyDTO } from "../services/developer";
import { authed } from "./guard";
import { fail, handle, invalid, type ActionResult } from "./util";

export async function requestApiAccessAction(): Promise<ActionResult> {
  const { user } = await authed();
  await grantApiAccess(user.id, user.role);
  return { ok: true };
}

async function developer() {
  const a = await authed();
  if (a.user.role === "USER") return null;
  return a;
}

export async function createApiKeyAction(input: unknown): Promise<ActionResult<{ key: ApiKeyDTO; secret: string }>> {
  const a = await developer();
  if (!a) return fail("Request API access first.");
  const parsed = apiKeySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    return { ok: true, data: await createApiKey(a.user.id, a.business.id, parsed.data.name, parsed.data.mode) };
  } catch (e) {
    return handle(e);
  }
}

export async function revokeApiKeyAction(id: string): Promise<ActionResult> {
  const a = await developer();
  if (!a) return fail("Request API access first.");
  try {
    await revokeApiKey(a.user.id, id);
    return { ok: true };
  } catch (e) {
    return handle(e);
  }
}

export async function regenerateApiKeyAction(id: string): Promise<ActionResult<{ key: ApiKeyDTO; secret: string }>> {
  const a = await developer();
  if (!a) return fail("Request API access first.");
  try {
    return { ok: true, data: await regenerateApiKey(a.user.id, a.business.id, id) };
  } catch (e) {
    return handle(e);
  }
}

export async function deleteApiKeyAction(id: string): Promise<ActionResult> {
  const a = await developer();
  if (!a) return fail("Request API access first.");
  try {
    await deleteApiKey(a.user.id, id);
    return { ok: true };
  } catch (e) {
    return handle(e);
  }
}

export async function createWebhookAction(input: unknown): Promise<ActionResult<{ secret: string }>> {
  const a = await developer();
  if (!a) return fail("Request API access first.");
  const parsed = webhookSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { secret } = await createWebhook(a.user.id, a.business.id, parsed.data);
    return { ok: true, data: { secret } };
  } catch (e) {
    return handle(e);
  }
}

export async function toggleWebhookAction(id: string, enabled: boolean): Promise<ActionResult> {
  const a = await developer();
  if (!a) return fail("Request API access first.");
  try {
    await setWebhookEnabled(a.user.id, a.business.id, id, enabled);
    return { ok: true };
  } catch (e) {
    return handle(e);
  }
}

export async function deleteWebhookAction(id: string): Promise<ActionResult> {
  const a = await developer();
  if (!a) return fail("Request API access first.");
  try {
    await deleteWebhook(a.user.id, a.business.id, id);
    return { ok: true };
  } catch (e) {
    return handle(e);
  }
}

export async function revealWebhookSecretAction(id: string): Promise<ActionResult<{ secret: string }>> {
  const a = await developer();
  if (!a) return fail("Request API access first.");
  try {
    return { ok: true, data: { secret: await revealWebhookSecret(a.business.id, id) } };
  } catch (e) {
    return handle(e);
  }
}

export async function retryWebhookEventAction(eventId: string): Promise<ActionResult> {
  const a = await developer();
  if (!a) return fail("Request API access first.");
  try {
    await retryWebhookEvent(a.business.id, eventId);
    return { ok: true };
  } catch (e) {
    return handle(e);
  }
}

export async function testWebhookAction(id: string): Promise<ActionResult<{ status: string; code: number | null }>> {
  const a = await developer();
  if (!a) return fail("Request API access first.");
  try {
    const ev = await sendTestWebhook(a.user.id, a.business.id, id);
    return { ok: true, data: { status: ev.status, code: ev.responseCode } };
  } catch (e) {
    return handle(e);
  }
}
