"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { deleteClientAction } from "@/lib/actions/clients";
import type { ClientDTO } from "@/lib/services/clients";
import { ClientFormDialog } from "./client-form";

export function ClientActions({ client }: { client: ClientDTO }) {
  const router = useRouter();
  const [edit, setEdit] = React.useState(false);
  const [del, setDel] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  return (
    <>
      <Button asChild><Link href={`/invoices/new?client=${client.id}`}><Plus className="size-4" aria-hidden />New invoice</Link></Button>
      <Button variant="outline" onClick={() => setEdit(true)}><Pencil className="size-4" aria-hidden />Edit</Button>
      <Button variant="ghost" className="text-destructive hover:bg-destructive-soft" onClick={() => setDel(true)}><Trash2 className="size-4" aria-hidden />Delete</Button>
      <ClientFormDialog client={client} open={edit} onOpenChange={setEdit} />
      <ConfirmDialog
        open={del}
        onOpenChange={setDel}
        title={`Delete ${client.name}?`}
        description="Existing invoices keep their client details. The client is removed from your list and can't be restored."
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          const res = await deleteClientAction(client.id);
          setBusy(false);
          if (res.ok) {
            toast.success("Client deleted");
            router.push("/clients");
            router.refresh();
          } else toast.error(res.error ?? "Couldn't delete the client");
        }}
      />
    </>
  );
}
