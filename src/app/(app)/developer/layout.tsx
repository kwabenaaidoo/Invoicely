import { PageHeader } from "@/components/ui/card";
import { DevNav } from "@/components/developer/dev-nav";

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-rise">
      <PageHeader title="Developer" description="Build invoicing directly into your application." />
      <DevNav />
      {children}
    </div>
  );
}
