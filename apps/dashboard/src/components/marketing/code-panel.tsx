import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

/** docs/DESIGN.md code block: Geist Mono 13px/1.55 on background-200, a subtle border, radius 8, copy top-right. */
export function CodePanel({ code, filename, className }: { code: string; filename: string; className?: string }) {
  return (
    <figure className={cn("min-w-0 overflow-hidden rounded-lg border border-border bg-surface-2", className)}>
      <figcaption className="flex h-10 items-center justify-between gap-3 border-b border-border pr-2 pl-4">
        <span className="truncate font-mono text-[13px] text-muted-foreground">{filename}</span>
        <CopyButton value={code} label="Copy code" />
      </figcaption>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-[1.55] text-foreground">
        <code>{code}</code>
      </pre>
    </figure>
  );
}
