import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

/* docs/DESIGN.md, Code blocks: Geist Mono 13px/1.55 on background-200, 1px border-subtle, radius 8, copy top-right. */
export function CodeBlock({ code, filename, className }: { code: string; filename?: string; className?: string }) {
  return (
    <div className={cn("relative min-w-0 overflow-hidden rounded-lg border border-border bg-surface-2", className)}>
      {filename ? (
        <div className="flex h-10 items-center justify-between gap-3 border-b border-border pr-1.5 pl-4">
          <span className="truncate font-mono text-[12px] text-muted-foreground">{filename}</span>
          <CopyButton value={code} label={`Copy ${filename}`} />
        </div>
      ) : (
        <CopyButton value={code} label="Copy code" className="absolute top-2 right-2 bg-surface-2" />
      )}
      <pre className={cn("overflow-x-auto p-4 font-mono text-[13px] leading-[1.55] text-foreground", !filename && "pr-12")}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
