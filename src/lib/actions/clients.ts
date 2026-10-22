"use server";

import { clientSchema } from "../validators";
import { createClient, deleteClient, updateClient, serializeClient, type ClientDTO } from "../services/clients";
import { authed, writeBudget } from "./guard";
import { handle, invalid, type ActionResult } from "./util";

export async function saveClientAction(ref: string | null, input: unknown): Promise<ActionResult<ClientDTO>> {
  const { ctx } = await authed();
  const limited = await writeBudget(ctx.userId);
  if (limited) return limited;
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const c = ref ? await updateClient(ctx, ref, parsed.data) : await createClient(ctx, parsed.data);
    return { ok: true, data: serializeClient(c) };
  } catch (e) {
    return handle(e);
  }
}

export async function deleteClientAction(ref: string): Promise<ActionResult> {
  const { ctx } = await authed();
  try {
    await deleteClient(ctx, ref);
    return { ok: true };
  } catch (e) {
    return handle(e);
  }
}
