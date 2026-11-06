import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  info: { box: "border-border bg-surface-2", dot: "text-info" },
  success: { box: "border-border bg-surface-2", dot: "text-success" },
  warning: { box: "border-warning/30 bg-warning-soft", dot: "text-warning" },
  danger: { box: "border-destructive/30 bg-destructive-soft", dot: "text-destructive-text" },
} as const;

/** Inline notice: neutral surface, the tone carried by a dot and (for warning/danger) a tinted fill. */
export function Alert({ tone = "info", children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  const t = tones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm text-foreground", t.box, className)}>
      <span aria-hidden className={cn("status-dot mt-[7px]", t.dot)} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
