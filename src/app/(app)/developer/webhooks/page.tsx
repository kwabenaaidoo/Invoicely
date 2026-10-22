import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth/dal";
import { listWebhookEvents, listWebhooks } from "@/lib/services/developer";
import { AccessGate } from "@/components/developer/access-gate";
import { WebhooksManager } from "@/components/developer/webhooks-manager";

export const metadata: Metadata = { title: "Webhooks" };

export default async function WebhooksPage() {
  const { user, business } = await requireBusiness();
  if (user.role === "USER") return <AccessGate />;
  const [hooks, events] = await Promise.all([listWebhooks(business.id), listWebhookEvents(business.id)]);
  return <WebhooksManager hooks={hooks} events={events} />;
}
