import "server-only";
import { requireBusiness } from "../auth/dal";
import { rateLimit } from "../rate-limit";
import { fail } from "./util";

/** Every mutating action starts here: signed-in user, their business, and a per-user write budget. */
export async function authed() {
  const { user, business } = await requireBusiness();
  return { user, business, ctx: { businessId: business.id, userId: user.id } };
}

export async function writeBudget(userId: string) {
  const rl = await rateLimit(`write:${userId}`, 240, 60);
  return rl.allowed ? null : fail("You're doing that too fast. Please wait a moment.");
}
