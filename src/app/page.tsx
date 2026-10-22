import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { HeroDemo } from "@/components/marketing/hero-demo";
import { DeveloperSection, Features, HowItWorks, Pricing, SiteFooter, SiteHeader } from "@/components/marketing/sections";

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <>
      <SiteHeader signedIn={!!user} />
      <main id="main">
        <section className="relative overflow-hidden">
          <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_srgb,var(--primary)_20%,transparent),transparent)]" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-24">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground"><span aria-hidden className="size-1.5 rounded-full bg-primary" />Invoices · Templates · API</p>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[56px]">Create Professional Invoices. Get Paid Faster.</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">Build beautiful, accurate invoices in minutes, brand them as your own, share a secure link or download a pixel-perfect PDF, and track every payment in one place.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg"><Link href="/signup">Create Your First Invoice<ArrowRight className="size-4" aria-hidden /></Link></Button>
                <Button asChild size="lg" variant="outline"><a href="#features">Explore Features</a></Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">Free to start. No credit card.</p>
            </div>
            <div>
              <HeroDemo />
              <p className="mt-2 text-center text-xs text-muted-foreground">Try it: change the client, quantity or colour.</p>
            </div>
          </div>
        </section>
        <Features />
        <HowItWorks />
        <DeveloperSection />
        <Pricing />
      </main>
      <SiteFooter />
    </>
  );
}
