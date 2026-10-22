import "server-only";
import { db } from "./db";
import type { Prisma } from "@/generated/prisma/client";

export async function audit(params: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}) {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        meta: params.meta,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (err) {
    // Audit failures must never break the user's request.
    console.error("audit log failed", err);
  }
}
