"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, FormError, Input, Textarea } from "@/components/ui/form";
import { clientSchema, type ClientInput } from "@/lib/validators";
import { saveClientAction } from "@/lib/actions/clients";
import type { ClientDTO } from "@/lib/services/clients";

export function ClientFormDialog({ client, open, onOpenChange }: { client?: ClientDTO; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<ClientInput>({
    resolver: zodResolver(clientSchema as never) as unknown as Resolver<ClientInput>,
    defaultValues: {
      name: client?.name ?? "", company: client?.company ?? "", email: client?.email ?? "", phone: client?.phone ?? "",
      addressLine1: client?.addressLine1 ?? "", addressLine2: client?.addressLine2 ?? "", city: client?.city ?? "", region: client?.region ?? "",
      postalCode: client?.postalCode ?? "", country: client?.country ?? "", taxId: client?.taxId ?? "", notes: client?.notes ?? "",
    },
  });
  const { register, handleSubmit, setError: setFieldError, reset, formState: { errors, isSubmitting } } = form;

  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (open) setError(null);
    if (!open) reset();
  }, [open, reset]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const submit = handleSubmit(async (values) => {
    setError(null);
    const res = await saveClientAction(client?.id ?? null, values);
    if (!res.ok) {
      setError(res.error ?? "Couldn't save the client");
      for (const [k, m] of Object.entries(res.fieldErrors ?? {})) setFieldError(k as never, { message: m });
      return;
    }
    toast.success(client ? "Client updated" : "Client added");
    onOpenChange(false);
    router.refresh();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={client ? "Edit client" : "Add client"} description="Saved clients can be selected when you create an invoice." className="max-w-xl">
        <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><FormError message={error} /></div>
          <Field label="Name" required error={errors.name?.message}>{(p) => <Input {...p} autoFocus {...register("name")} />}</Field>
          <Field label="Company" error={errors.company?.message}>{(p) => <Input {...p} {...register("company")} />}</Field>
          <Field label="Email" error={errors.email?.message}>{(p) => <Input {...p} type="email" {...register("email")} />}</Field>
          <Field label="Phone" error={errors.phone?.message}>{(p) => <Input {...p} type="tel" {...register("phone")} />}</Field>
          <Field label="Address line 1" className="sm:col-span-2" error={errors.addressLine1?.message}>{(p) => <Input {...p} {...register("addressLine1")} />}</Field>
          <Field label="Address line 2" className="sm:col-span-2" error={errors.addressLine2?.message}>{(p) => <Input {...p} {...register("addressLine2")} />}</Field>
          <Field label="City" error={errors.city?.message}>{(p) => <Input {...p} {...register("city")} />}</Field>
          <Field label="State / region" error={errors.region?.message}>{(p) => <Input {...p} {...register("region")} />}</Field>
          <Field label="Postal code" error={errors.postalCode?.message}>{(p) => <Input {...p} {...register("postalCode")} />}</Field>
          <Field label="Country" error={errors.country?.message}>{(p) => <Input {...p} {...register("country")} />}</Field>
          <Field label="Tax ID" className="sm:col-span-2" error={errors.taxId?.message}>{(p) => <Input {...p} {...register("taxId")} />}</Field>
          <Field label="Notes" className="sm:col-span-2" hint="Only visible to you." error={errors.notes?.message}>{(p) => <Textarea {...p} rows={3} {...register("notes")} />}</Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{client ? "Save changes" : "Add client"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddClientButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Add client</Button>
      <ClientFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
