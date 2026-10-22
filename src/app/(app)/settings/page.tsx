import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { currentSessionHash } from "@/lib/auth/session";
import { assetUrl } from "@/lib/storage";
import { PageHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppearancePanel, BusinessForm, InvoiceSettingsForm, ProfileForm, SecurityPanel } from "@/components/settings/settings-forms";

export const metadata: Metadata = { title: "Settings" };

const nz = (v: string | null) => v ?? undefined;

function device(ua: string | null) {
  if (!ua) return "Unknown device";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}

export default async function SettingsPage() {
  const { user, business: b } = await requireBusiness();
  const [sessions, keep, row] = await Promise.all([
    db.session.findMany({ where: { userId: user.id, expiresAt: { gt: new Date() } }, orderBy: { lastUsedAt: "desc" }, take: 20 }),
    currentSessionHash(),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } }),
  ]);
  return (
    <div className="animate-rise">
      <PageHeader title="Settings" />
      <Tabs defaultValue="profile">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="mb-6 min-w-max">
            {["profile", "business", "invoices", "appearance", "security"].map((t) => <TabsTrigger key={t} value={t} className="px-4 capitalize">{t}</TabsTrigger>)}
          </TabsList>
        </div>
        <TabsContent value="profile"><ProfileForm defaults={{ name: user.name, email: user.email }} verified={user.emailVerified} /></TabsContent>
        <TabsContent value="business">
          <BusinessForm
            defaults={{ name: b.name, email: nz(b.email), phone: nz(b.phone), website: nz(b.website), taxId: nz(b.taxId), addressLine1: nz(b.addressLine1), addressLine2: nz(b.addressLine2), city: nz(b.city), region: nz(b.region), postalCode: nz(b.postalCode), country: nz(b.country), paymentInfo: nz(b.paymentInfo) }}
            logoUrl={assetUrl(b.logoKey)}
            signatureUrl={assetUrl(b.signatureKey)}
          />
        </TabsContent>
        <TabsContent value="invoices">
          <InvoiceSettingsForm defaults={{ defaultCurrency: b.defaultCurrency, invoicePrefix: b.invoicePrefix, invoiceNumberPadding: b.invoiceNumberPadding, nextInvoiceNumber: b.nextInvoiceNumber, defaultPaymentTerms: b.defaultPaymentTerms, defaultTaxRate: Number(b.defaultTaxRate.toString()), defaultNotes: nz(b.defaultNotes), defaultFooter: nz(b.defaultFooter) }} />
        </TabsContent>
        <TabsContent value="appearance"><AppearancePanel /></TabsContent>
        <TabsContent value="security">
          <SecurityPanel hasPassword={!!row.passwordHash} sessions={sessions.map((s) => ({ id: s.id, device: device(s.userAgent), ip: s.ipAddress, lastUsed: s.lastUsedAt.toISOString(), current: s.tokenHash === keep }))} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
