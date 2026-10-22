import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme";
import { InvoiceMini } from "@/components/marketing/invoice-mini";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </header>
        <main id="main" className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          {children}
        </main>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Invoicely</p>
      </div>
      <aside aria-hidden className="relative hidden overflow-hidden border-l bg-muted/60 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_20%,color-mix(in_srgb,var(--primary)_18%,transparent),transparent)]" />
        <div className="relative flex h-full flex-col justify-center gap-8 px-14">
          <div className="max-w-md">
            <p className="text-2xl font-semibold tracking-tight">Send invoices that look as professional as your work.</p>
            <p className="mt-2 text-sm text-muted-foreground">Create, customise, share and track — and plug it into your own product with the API.</p>
          </div>
          <div className="w-full max-w-[460px] -rotate-1 shadow-card">
            <InvoiceMini />
          </div>
        </div>
      </aside>
    </div>
  );
}
