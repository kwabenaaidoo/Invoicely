import type { Metadata } from "next";
import Link from "next/link";
import { requireBusiness } from "@/lib/auth/dal";
import { listTemplates } from "@/lib/services/templates";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { TemplateCard } from "@/components/templates/template-ui";
import { sampleView } from "@/components/marketing/sample";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const { business } = await requireBusiness();
  const templates = await listTemplates(business.id, business.defaultTemplateId);
  const view = sampleView({ status: "DRAFT" });
  return (
    <div className="animate-rise">
      <PageHeader title="Templates" description="Start from a built-in design or save your own from the invoice builder's Design tab." actions={<Button asChild><Link href="/invoices/new">Customise in builder</Link></Button>} />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Invoice templates">
        {templates.map((t) => <TemplateCard key={t.id} t={t} view={view} />)}
      </ul>
    </div>
  );
}
