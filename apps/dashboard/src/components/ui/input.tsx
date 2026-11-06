import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* docs/DESIGN.md, Inputs: 36px (44px mobile, 16px text), radius 6, border-default, hover border-strong, focus ring. */
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border border-border-default bg-background px-3 text-sm text-foreground transition-[border-color] duration-150 outline-none placeholder:text-faint hover:border-border-strong focus-visible:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive max-sm:h-11 max-sm:text-base",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[13px] leading-5 font-medium text-foreground", className)} {...props} />;
}

export function FieldHint({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="text-[13px] leading-5 text-muted-foreground">
      {children}
    </p>
  );
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="flex items-center gap-1.5 text-[13px] leading-5 text-destructive-text">
      <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <circle cx="8" cy="8" r="6.25" />
        <path d="M8 4.75v3.75M8 11h.01" strokeLinecap="round" />
      </svg>
      {children}
    </p>
  );
}
