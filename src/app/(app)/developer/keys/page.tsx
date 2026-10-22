import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth/dal";
import { listApiKeys } from "@/lib/services/developer";
import { AccessGate } from "@/components/developer/access-gate";
import { KeysManager } from "@/components/developer/keys-manager";

export const metadata: Metadata = { title: "API Keys" };

export default async function KeysPage() {
  const { user } = await requireBusiness();
  if (user.role === "USER") return <AccessGate />;
  return <KeysManager keys={await listApiKeys(user.id)} />;
}
