"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { requestApiAccessAction } from "@/lib/actions/developer";

export function AccessGate() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <EmptyState
      icon={<KeyRound />}
      title="Request API access"
      description="Get API keys, webhooks and usage analytics. Access is instant while Invoicely is in early release."
      action={
        <Button loading={busy} onClick={async () => { setBusy(true); const r = await requestApiAccessAction(); setBusy(false); if (r.ok) { toast.success("API access enabled"); router.refresh(); } else toast.error(r.error ?? "Couldn't enable access"); }}>
          Request API access
        </Button>
      }
    />
  );
}
