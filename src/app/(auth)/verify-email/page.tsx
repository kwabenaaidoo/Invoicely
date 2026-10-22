import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, MailCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResendVerification } from "@/components/auth/auth-forms";
import { verifyEmailToken } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Verify email", robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const user = await getCurrentUser();

  if (token) {
    const result = await verifyEmailToken(token);
    return result === "verified" ? (
      <div role="status" className="text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-soft-foreground"><CircleCheck className="size-6" aria-hidden /></div>
        <h1 className="text-2xl font-semibold tracking-tight">Email verified</h1>
        <p className="mt-2 text-sm text-muted-foreground">Thanks — your email address is confirmed.</p>
        <Button asChild className="mt-6"><Link href={user ? "/dashboard" : "/login"}>{user ? "Go to dashboard" : "Sign in"}</Link></Button>
      </div>
    ) : (
      <div role="alert" className="text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive-soft text-destructive"><TriangleAlert className="size-6" aria-hidden /></div>
        <h1 className="text-2xl font-semibold tracking-tight">Link invalid or expired</h1>
        <p className="mt-2 text-sm text-muted-foreground">Verification links expire after 24 hours.</p>
        <div className="mt-6 flex justify-center">{user ? <ResendVerification /> : <Button asChild><Link href="/login">Sign in to resend</Link></Button>}</div>
      </div>
    );
  }

  return (
    <div role="status" className="text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-soft-foreground"><MailCheck className="size-6" aria-hidden /></div>
      <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
      <p className="mt-2 text-sm text-muted-foreground">{user ? `We sent a verification link to ${user.email}.` : "Open the verification link we emailed you."}</p>
      <div className="mt-6 flex justify-center gap-2">{user ? <ResendVerification /> : <Button asChild><Link href="/login">Sign in</Link></Button>}</div>
    </div>
  );
}
