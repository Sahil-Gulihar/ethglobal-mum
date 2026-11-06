import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

export function CodeBlock({ code, filename, className }: { code: string; filename?: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-white/10 bg-ink text-white", className)}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-2">
          <span aria-hidden className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
          </span>
          {filename && <span className="font-mono text-xs text-white/60">{filename}</span>}
        </div>
        <CopyButton value={code} label="Copy code" showLabel className="text-white/70 hover:bg-white/10 hover:text-white" />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-white/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}
