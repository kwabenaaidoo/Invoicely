import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "@/components/auth/auth-forms";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <div role="alert" className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">This link is incomplete</h1>
        <p className="mt-2 text-sm text-muted-foreground">Request a new password reset email to continue.</p>
        <Button asChild className="mt-6"><Link href="/forgot-password">Request a new link</Link></Button>
      </div>
    );
  }
  return <ResetForm token={token} />;
}
