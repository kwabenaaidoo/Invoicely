"use server";

import { templateSchema } from "../validators";
import { createTemplate, deleteTemplate, setDefaultTemplate, updateTemplate } from "../services/templates";
import { authed, writeBudget } from "./guard";
import { handle, invalid, type ActionResult } from "./util";

export async function saveTemplateAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const { ctx } = await authed();
  const limited = await writeBudget(ctx.userId);
  if (limited) return limited;
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const t = id ? await updateTemplate(ctx, id, parsed.data.name, parsed.data.design) : await createTemplate(ctx, parsed.data.name, parsed.data.design);
    return { ok: true, data: { id: t.id } };
  } catch (e) {
    return handle(e);
  }
}

export async function deleteTemplateAction(id: string): Promise<ActionResult> {
  const { ctx } = await authed();
  try {
    await deleteTemplate(ctx, id);
    return { ok: true };
  } catch (e) {
    return handle(e);
  }
}

export async function setDefaultTemplateAction(id: string | null): Promise<ActionResult> {
  const { ctx } = await authed();
  try {
    await setDefaultTemplate(ctx, id);
    return { ok: true };
  } catch (e) {
    return handle(e);
  }
}
