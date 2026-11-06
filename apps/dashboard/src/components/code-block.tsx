import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

export function CodeBlock({ code, filename, className }: { code: string; filename?: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-md border-[0.5px] bg-card text-foreground", className)}>
      <div className="flex items-center justify-between min-h-9 border-b-[0.5px] px-3">
        <div className="flex items-center gap-2">
          {filename && <span className="font-mono text-xs text-muted-foreground">{filename}</span>}
        </div>
        <CopyButton value={code} label="Copy code" showLabel />
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
