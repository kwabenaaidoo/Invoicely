import Link from "next/link";
import { Blocks, Check, FileDown, FileText, LayoutTemplate, LineChart, Link2, Palette, Users } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme";
import { Button } from "@/components/ui/button";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#how" className="hover:text-foreground">How it works</a>
          <a href="#developers" className="hover:text-foreground">Developers</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {signedIn ? (
            <Button asChild><Link href="/dashboard">Dashboard</Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link href="/login">Sign in</Link></Button>
              <Button asChild><Link href="/signup">Get started</Link></Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

const FEATURES = [
  { icon: FileText, title: "Professional invoices", text: "Accurate maths, taxes, discounts and shipping, with a live preview as you type." },
  { icon: LayoutTemplate, title: "Custom templates", text: "Modern, Minimal, Corporate and Classic. Save your own and set a default." },
  { icon: Users, title: "Client management", text: "A light CRM: contacts, history, what you've invoiced and what's outstanding." },
  { icon: FileDown, title: "PDF export", text: "Server-rendered PDFs that match the preview: fonts, logo, colours and totals." },
  { icon: LineChart, title: "Invoice tracking", text: "Draft, sent, paid, overdue. Know where every invoice stands at a glance." },
  { icon: Blocks, title: "Developer API", text: "Create invoices from your own product with a REST API and signed webhooks." },
  { icon: Link2, title: "Secure sharing", text: "Unguessable links your clients can open and download. Revoke any time." },
  { icon: Palette, title: "Business branding", text: "Your logo, colours and fonts on every invoice, in light or dark mode." },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-t py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-sm font-semibold text-link">Features</p>
        <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">Everything you need to bill clients properly</h2>
        <ul className="mt-10 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="bg-card p-6">
              <span className="inline-flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-foreground"><Icon className="size-5" aria-hidden /></span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const STEPS = [
  ["Add your business", "Name, logo, tax details and payment info, once."],
  ["Add your client", "Save contacts so they're one click away next time."],
  ["Create your invoice", "Add items, taxes and discounts. Totals update live."],
  ["Customise it", "Pick a template, brand colour and font."],
  ["Download or share", "Export a PDF, print it, or send a secure link."],
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 border-t bg-muted/40 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-sm font-semibold text-link">How it works</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">From zero to paid in five steps</h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-5">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="rounded-xl border bg-card p-5">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
              <h3 className="mt-3 font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function DeveloperSection() {
  return (
    <section id="developers" className="scroll-mt-20 border-t py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-link">For developers</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Build invoicing directly into your application.</h2>
          <p className="mt-4 max-w-md text-muted-foreground">A versioned REST API with test and live keys, rate limiting, consistent JSON errors, PDF generation and signed webhooks. SaaS billing, e-commerce, POS, accounting: if it bills, it fits.</p>
          <ul className="mt-5 grid gap-2 text-sm">
            {["Test & live API keys", "Invoices, clients and products endpoints", "HMAC-signed webhooks with retries", "Docs in cURL, JS, TypeScript, Python & PHP"].map((t) => <li key={t} className="flex items-center gap-2"><Check className="size-4 text-link" aria-hidden />{t}</li>)}
          </ul>
          <Button asChild size="lg" className="mt-7"><Link href="/developer/docs">Explore Developer API</Link></Button>
        </div>
        <pre className="overflow-x-auto rounded-xl border bg-[#10130d] p-5 font-mono text-[12.5px] leading-relaxed text-[#e6ecd9] shadow-card" tabIndex={0}><code>{`POST /api/v1/invoices
Authorization: Bearer sk_live_…

{
  "client": { "name": "Globex Ltd" },
  "items": [
    { "description": "Design", "quantity": 1,
      "unitPrice": 1200, "taxRate": 10 }
  ],
  "status": "sent"
}

→ 201
{
  "success": true,
  "data": {
    "id": "inv_3f9c…",
    "invoiceNumber": "INV-0001",
    "status": "sent",
    "total": "1320.00",
    "publicUrl": "https://…/invoice/public/…"
  }
}`}</code></pre>
      </div>
    </section>
  );
}

const PLANS = [
  { name: "Free", price: "$0", note: "For getting started", features: ["Unlimited invoices", "4 templates", "PDF export & share links", "Test API key"], cta: "Start free", featured: false },
  { name: "Pro", price: "$12", note: "per month · coming soon", features: ["Everything in Free", "Custom templates & branding", "Live API keys & webhooks", "Priority support"], cta: "Start free", featured: true },
  { name: "Business", price: "$39", note: "per month · coming soon", features: ["Everything in Pro", "Higher API limits", "Multiple businesses", "Team members"], cta: "Start free", featured: false },
];

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 border-t bg-muted/40 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-sm font-semibold text-link">Pricing</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Simple plans that grow with you</h2>
        <p className="mt-2 text-muted-foreground">Everything is free while we're in early release. Paid plans arrive with subscriptions.</p>
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {PLANS.map((p) => (
            <li key={p.name} className={`flex flex-col rounded-xl border bg-card p-6 ${p.featured ? "border-primary ring-2 ring-primary/40" : ""}`}>
              <h3 className="font-semibold">{p.name}{p.featured ? <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-[11px] font-bold uppercase text-primary-foreground">Popular</span> : null}</h3>
              <p className="mt-3 text-4xl font-semibold tracking-tight">{p.price}</p>
              <p className="text-sm text-muted-foreground">{p.note}</p>
              <ul className="my-6 grid gap-2.5 text-sm">{p.features.map((f) => <li key={f} className="flex items-center gap-2"><Check className="size-4 shrink-0 text-link" aria-hidden />{f}</li>)}</ul>
              <Button asChild variant={p.featured ? "primary" : "outline"} className="mt-auto"><Link href="/signup">{p.cta}</Link></Button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function SiteFooter() {
  const cols = [
    { h: "Product", links: [["Features", "#features"], ["Pricing", "#pricing"], ["How it works", "#how"]] },
    { h: "Developers", links: [["Developer API", "#developers"], ["Documentation", "/developer/docs"], ["API keys", "/developer/keys"]] },
    { h: "Company", links: [["Privacy", "/privacy"], ["Terms", "/terms"], ["Contact", "/contact"]] },
  ];
  return (
    <footer className="border-t py-12">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div><Logo /><p className="mt-3 max-w-xs text-sm text-muted-foreground">Professional invoices, paid faster.</p></div>
        {cols.map((c) => (
          <nav key={c.h} aria-label={c.h}>
            <h2 className="text-sm font-semibold">{c.h}</h2>
            <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">{c.links.map(([l, h]) => <li key={l}><Link href={h!} className="hover:text-foreground">{l}</Link></li>)}</ul>
          </nav>
        ))}
      </div>
      <p className="mx-auto mt-10 max-w-6xl px-4 text-xs text-muted-foreground sm:px-6">© {new Date().getFullYear()} Invoicely. All rights reserved.</p>
    </footer>
  );
}
