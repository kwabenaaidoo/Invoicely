import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Privacy" };

export default function Page() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-12">
      <Logo />
      <h1 className="mt-10 text-3xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-2 text-muted-foreground">How Invoicely handles your data.</p>
      <p className="mt-6 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">This page is a placeholder for the MVP. Replace it with your reviewed legal and contact content before launch.</p>
    </main>
  );
}
