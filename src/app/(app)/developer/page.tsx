import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Building2, Calculator, Cog, Receipt, ShoppingCart } from "lucide-react";
import { requireBusiness } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AccessGate } from "@/components/developer/access-gate";

export const metadata: Metadata = { title: "Developer" };

const CASES = [
  { icon: Receipt, title: "SaaS billing", text: "Issue an invoice whenever a subscription renews or usage is metered." },
  { icon: ShoppingCart, title: "E-commerce", text: "Attach a branded PDF invoice to every order confirmation." },
  { icon: Calculator, title: "POS systems", text: "Generate tax-ready invoices at the till and share a link by SMS." },
  { icon: Boxes, title: "Accounting systems", text: "Sync invoices, clients and statuses with your ledger via webhooks." },
  { icon: Building2, title: "Business platforms", text: "Offer invoicing to your own customers without building it." },
];

export default async function DeveloperOverview() {
  const { user } = await requireBusiness();
  const has = user.role !== "USER";
  return (
    <div className="grid gap-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold tracking-tight">Generate invoices programmatically</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Generate invoices programmatically and integrate our invoicing infrastructure into your application. A versioned REST API, signed webhooks, test and live keys.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild><Link href="/developer/docs">Read the docs</Link></Button>
          {has ? <Button asChild variant="outline"><Link href="/developer/keys">Manage API keys</Link></Button> : null}
        </div>
        <pre className="mt-5 overflow-x-auto rounded-lg border bg-muted p-4 font-mono text-[13px] leading-relaxed"><code>{`curl https://your-domain.com/api/v1/invoices \\
  -H "Authorization: Bearer sk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"client":{"name":"Globex"},"items":[{"description":"Design","quantity":1,"unitPrice":1200}]}'`}</code></pre>
      </Card>
      {!has ? <AccessGate /> : null}
      <section aria-labelledby="uc">
        <h2 id="uc" className="mb-3 text-base font-semibold tracking-tight">Built for</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CASES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-lg border bg-card p-4">
              <span className="inline-flex size-9 items-center justify-center rounded-md bg-accent-soft text-accent-soft-foreground"><Icon className="size-[18px]" aria-hidden /></span>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
          <li className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground"><Cog className="size-5 shrink-0" aria-hidden />Something else? The API is resource-based and easy to compose.</li>
        </ul>
      </section>
    </div>
  );
}
