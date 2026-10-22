import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Contact" };

export default function Page() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-12">
      <Logo />
      <h1 className="mt-10 text-3xl font-semibold tracking-tight">Contact</h1>
      <p className="mt-2 text-muted-foreground">Questions, feedback or support.</p>
      <p className="mt-6 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">This page is a placeholder for the MVP. Replace it with your reviewed legal and contact content before launch.</p>
    </main>
  );
}
