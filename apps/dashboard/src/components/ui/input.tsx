import type { InputHTMLAttributes, LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/* Stageshow field: 34px, 8px radius, a hairline ring at rest and the accent ring only on real focus. */
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-[34px] w-full min-w-0 rounded-md bg-background px-3 text-[13px] text-foreground shadow-[0_0_0_1px_var(--input),0_1px_2px_rgb(0_0_0/0.04)] transition-shadow duration-150 outline-none placeholder:text-faint focus-visible:shadow-[0_0_0_1px_var(--ring),0_0_0_4px_rgb(59_91_255/0.15)] disabled:cursor-not-allowed disabled:bg-well disabled:opacity-70 aria-invalid:shadow-[0_0_0_1px_var(--destructive),0_0_0_4px_rgb(239_68_68/0.12)]",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[13px] leading-none font-medium text-foreground", className)} {...props} />;
}

export function FieldError({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-xs font-medium text-destructive-text">
      {children}
    </p>
  );
}
