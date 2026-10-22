import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth/dal";
import { AppShell } from "@/components/app/app-shell";
import { ResendVerification } from "@/components/auth/auth-forms";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireBusiness();
  const rows = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 8 });
  return (
    <AppShell
      user={{ name: user.name, email: user.email }}
      notifications={rows.map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, read: !!n.readAt, at: n.createdAt.toISOString() }))}
    >
      {!user.emailVerified ? (
        <div role="status" className="mb-6 flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
          <span>Verify <strong>{user.email}</strong> to secure your account. Check your inbox for the link.</span>
          <ResendVerification />
        </div>
      ) : null}
      {children}
    </AppShell>
  );
}
