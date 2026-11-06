"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icons";

export function CopyButton({ value, label = "Copy", className, showLabel = false }: { value: string; label?: string; className?: string; showLabel?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={cn(
        "inline-flex h-7 min-w-7 shrink-0 items-center justify-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-icon outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Icon name={copied ? "check" : "copy"} className="size-3.5" />
      {showLabel && <span>{copied ? "Copied" : label}</span>}
    </button>
  );
}
