import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

/* Stageshow badge: soft status fill, strong status text, a pill, label trimmed to cap height. */
const tones: Record<BadgeTone, string> = {
  neutral: "bg-black/[0.05] text-muted-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive-soft text-destructive-text",
  info: "bg-accent text-accent-foreground",
};

const dots: Record<BadgeTone, string> = {
  neutral: "bg-faint",
  success: "bg-success-dot",
  warning: "bg-warning-dot",
  danger: "bg-destructive",
  info: "bg-primary",
};

export function Badge({ className, tone = "neutral", dot, children, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span
      className={cn("inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[11.5px] leading-none font-medium whitespace-nowrap", tones[tone], className)}
      {...props}
    >
      {dot && <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", dots[tone])} />}
      {children}
    </span>
  );
}
