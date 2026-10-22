"use server";

import { productSchema } from "../validators";
import { createProduct, deleteProduct, updateProduct, serializeProduct, type ProductDTO } from "../services/products";
import { authed, writeBudget } from "./guard";
import { handle, invalid, type ActionResult } from "./util";

export async function saveProductAction(ref: string | null, input: unknown): Promise<ActionResult<ProductDTO>> {
  const { ctx } = await authed();
  const limited = await writeBudget(ctx.userId);
  if (limited) return limited;
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const p = ref ? await updateProduct(ctx, ref, parsed.data) : await createProduct(ctx, parsed.data);
    return { ok: true, data: serializeProduct(p) };
  } catch (e) {
    return handle(e);
  }
}

export async function deleteProductAction(ref: string): Promise<ActionResult> {
  const { ctx } = await authed();
  try {
    await deleteProduct(ctx, ref);
    return { ok: true };
  } catch (e) {
    return handle(e);
  }
}
