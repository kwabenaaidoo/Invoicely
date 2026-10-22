"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { forgotSchema, loginSchema, resetSchema, signupSchema, type LoginInput, type SignupInput } from "@/lib/validators";
import { login, requestPasswordReset, resetPassword, resendVerification, signup } from "@/lib/actions/auth";
import type { ActionResult } from "@/lib/actions/util";
import { toast } from "sonner";

function useServerForm<T extends Record<string, unknown>>(schema: unknown, defaults?: Partial<T>) {
  const form = useForm<T>({ resolver: zodResolver(schema as never) as unknown as Resolver<T>, defaultValues: defaults as never, mode: "onTouched" });
  const [formError, setFormError] = React.useState<string | null>(null);
  const apply = (res: ActionResult | void) => {
    if (!res || res.ok) return true;
    setFormError(res.error ?? "Something went wrong. Please try again.");
    for (const [k, msg] of Object.entries(res.fieldErrors ?? {})) form.setError(k as never, { message: msg });
    const first = Object.keys(res.fieldErrors ?? {})[0];
    if (first) form.setFocus(first as never);
    return false;
  };
  return { form, formError, setFormError, apply };
}

function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-11" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
      >
        {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

export function Heading({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="text-[26px] font-semibold tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

export function LoginForm({ notice }: { notice?: string }) {
  const { form, formError, setFormError, apply } = useServerForm<LoginInput>(loginSchema, { email: "", password: "", remember: true });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;
  return (
    <>
      <Heading title="Welcome back" subtitle={<>New here? <Link href="/signup" className="font-medium text-link underline-offset-4 hover:underline">Create an account</Link></>} />
      {notice ? <p role="status" className="mb-4 rounded-md border border-success/30 bg-success-soft px-3 py-2.5 text-sm text-success">{notice}</p> : null}
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(async (v) => {
          setFormError(null);
          apply(await login(v));
        })}
      >
        <FormError message={formError} />
        <Field label="Email" error={errors.email?.message} required>
          {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" placeholder="you@company.com" {...register("email")} />}
        </Field>
        <Field label="Password" error={errors.password?.message} required>
          {(p) => <PasswordInput {...p} autoComplete="current-password" {...register("password")} />}
        </Field>
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--ring)]" {...register("remember")} />
            Remember me
          </label>
          <Link href="/forgot-password" className="text-sm font-medium text-link underline-offset-4 hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" size="lg" loading={isSubmitting}>{isSubmitting ? "Signing in…" : "Sign in"}</Button>
      </form>
    </>
  );
}

export function SignupForm() {
  const { form, formError, setFormError, apply } = useServerForm<SignupInput>(signupSchema, { name: "", email: "", password: "", confirmPassword: "" });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;
  return (
    <>
      <Heading title="Create your account" subtitle={<>Already have one? <Link href="/login" className="font-medium text-link underline-offset-4 hover:underline">Sign in</Link></>} />
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(async (v) => {
          setFormError(null);
          apply(await signup(v));
        })}
      >
        <FormError message={formError} />
        <Field label="Full name" error={errors.name?.message} required>
          {(p) => <Input {...p} autoComplete="name" placeholder="Ada Mensah" {...register("name")} />}
        </Field>
        <Field label="Email" error={errors.email?.message} required>
          {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" placeholder="you@company.com" {...register("email")} />}
        </Field>
        <Field label="Password" error={errors.password?.message} hint="At least 10 characters, with a letter and a number." required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" {...register("password")} />}
        </Field>
        <Field label="Confirm password" error={errors.confirmPassword?.message} required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" {...register("confirmPassword")} />}
        </Field>
        <Button type="submit" size="lg" loading={isSubmitting}>{isSubmitting ? "Creating account…" : "Create account"}</Button>
        <p className="text-center text-xs text-muted-foreground">By creating an account you agree to the <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
      </form>
    </>
  );
}

export function ForgotForm() {
  const { form, formError, setFormError, apply } = useServerForm<{ email: string }>(forgotSchema, { email: "" });
  const [sent, setSent] = React.useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;
  if (sent) {
    return (
      <div role="status" className="text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-soft-foreground"><MailCheck className="size-6" aria-hidden /></div>
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">If an account exists for that address, we've sent a link to reset your password. It expires in 1 hour.</p>
        <Button asChild variant="outline" className="mt-6"><Link href="/login">Back to sign in</Link></Button>
      </div>
    );
  }
  return (
    <>
      <Heading title="Forgot your password?" subtitle="Enter your email and we'll send you a reset link." />
      <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit(async (v) => { setFormError(null); if (apply(await requestPasswordReset(v))) setSent(true); })}>
        <FormError message={formError} />
        <Field label="Email" error={errors.email?.message} required>
          {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" {...register("email")} />}
        </Field>
        <Button type="submit" size="lg" loading={isSubmitting}>Send reset link</Button>
        <Link href="/login" className="text-center text-sm font-medium text-link underline-offset-4 hover:underline">Back to sign in</Link>
      </form>
    </>
  );
}

export function ResetForm({ token }: { token: string }) {
  const { form, formError, setFormError, apply } = useServerForm<{ token: string; password: string; confirmPassword: string }>(resetSchema, { token, password: "", confirmPassword: "" });
  const [done, setDone] = React.useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;
  if (done) {
    return (
      <div role="status" className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Password updated</h1>
        <p className="mt-2 text-sm text-muted-foreground">You've been signed out everywhere. Sign in with your new password.</p>
        <Button asChild className="mt-6"><Link href="/login">Continue to sign in</Link></Button>
      </div>
    );
  }
  return (
    <>
      <Heading title="Choose a new password" />
      <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit(async (v) => { setFormError(null); if (apply(await resetPassword(v))) setDone(true); })}>
        <FormError message={formError} />
        <Field label="New password" error={errors.password?.message} hint="At least 10 characters, with a letter and a number." required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" {...register("password")} />}
        </Field>
        <Field label="Confirm new password" error={errors.confirmPassword?.message} required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" {...register("confirmPassword")} />}
        </Field>
        <Button type="submit" size="lg" loading={isSubmitting}>Update password</Button>
      </form>
    </>
  );
}

export function ResendVerification() {
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      variant="outline"
      loading={pending}
      onClick={async () => {
        setPending(true);
        const res = await resendVerification();
        setPending(false);
        if (res.ok) toast.success("Verification email sent");
        else toast.error(res.error ?? "Couldn't send the email");
      }}
    >
      Resend verification email
    </Button>
  );
}
