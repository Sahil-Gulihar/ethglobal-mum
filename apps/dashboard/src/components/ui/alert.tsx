import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  info: "border-primary/25 bg-accent text-accent-foreground",
  success: "border-success/25 bg-success-soft text-success",
  warning: "border-warning/25 bg-warning-soft text-warning",
  danger: "border-destructive/25 bg-destructive/8 text-destructive",
} as const;

export function Alert({ tone = "info", children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-none border-[0.5px] px-3.5 py-2.5 text-sm", tones[tone], className)}>
      {children}
    </div>
  );
}
