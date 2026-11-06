import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  info: "bg-accent text-accent-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive-soft text-destructive-text",
} as const;

export function Alert({ tone = "info", children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-md px-3 py-2.5 text-[13px] leading-5", tones[tone], className)}>
      {children}
    </div>
  );
}
