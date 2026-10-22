import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "../db";
import { getSession } from "./session";
import type { Role } from "@/generated/prisma/client";

/**
 * Data Access Layer. Every page, server action and route handler gets its user and
 * business through here, and every query downstream is scoped by `business.id`.
 * That single predicate is what keeps one tenant's data away from another.
 */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const { user } = session;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    emailVerified: !!user.emailVerifiedAt,
    themePreference: user.themePreference,
  };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role) && user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

export const getBusinessForUser = cache(async (userId: string) => {
  const existing = await db.business.findFirst({ where: { ownerId: userId }, orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
  return db.business.create({ data: { ownerId: userId, name: `${user.name.split(" ")[0]}'s Business` } });
});

export async function requireBusiness() {
  const user = await requireUser();
  const business = await getBusinessForUser(user.id);
  return { user, business };
}
