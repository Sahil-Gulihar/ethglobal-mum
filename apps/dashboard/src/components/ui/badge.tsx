import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

/* docs/DESIGN.md, Status: 13px medium text with a 6px dot in the semantic color. Not a filled pill. */
const tones: Record<BadgeTone, string> = {
  neutral: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive-text",
  info: "text-info",
};

export function Badge({ className, tone = "neutral", dot = true, children, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] leading-5 font-medium whitespace-nowrap", tones[tone], className)} {...props}>
      {dot && <span aria-hidden className="status-dot" />}
      <span className={tone === "neutral" ? undefined : "text-foreground"}>{children}</span>
    </span>
  );
}
