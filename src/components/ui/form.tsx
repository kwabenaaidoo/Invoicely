"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-md border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground/80 transition-[border-color,box-shadow] duration-150 hover:border-muted-foreground/50 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, type = "text", ...props }, ref) {
  return <input ref={ref} type={type} className={cn(control, "h-10", className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(control, "min-h-[84px] resize-y py-2 leading-relaxed", className)} {...props} />;
});

/** Native <select>: best-in-class accessibility and touch behaviour, styled to match. */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, "h-10 appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
});

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[13px] font-medium text-foreground", className)} {...props} />;
}

type FieldRenderProps = { id: string; "aria-invalid": boolean | undefined; "aria-describedby": string | undefined; "aria-required"?: boolean };

/**
 * Wires label, hint and error to a control for screen readers.
 * <Field label="Email" error={errors.email?.message}>{(p) => <Input {...p} {...register("email")} />}</Field>
 */
export function Field({
  label,
  error,
  hint,
  required,
  className,
  children,
  labelHidden,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  labelHidden?: boolean;
  children: (props: FieldRenderProps) => React.ReactNode;
}) {
  const id = React.useId();
  const errId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id} className={labelHidden ? "sr-only" : undefined}>
        {label}
        {required ? <span aria-hidden className="ml-0.5 text-muted-foreground">*</span> : null}
      </Label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, ...(required ? { "aria-required": true } : {}) })}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errId} role="alert" className="flex items-start gap-1.5 text-xs font-medium text-destructive">
          <svg aria-hidden viewBox="0 0 20 20" className="mt-px size-3.5 shrink-0" fill="currentColor">
            <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-.75 4.5a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0v-4ZM10 14.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
          </svg>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
      {message}
    </div>
  );
}
