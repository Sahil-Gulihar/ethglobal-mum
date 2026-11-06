import { CopyButton } from "@/components/ui/copy-button";
import { codeHighlighter, codeThemes } from "@/lib/code-highlighting";
import { cn } from "@/lib/utils";

export async function CodeBlock({ code, language, filename, className }: { code: string; language: string; filename?: string; className?: string }) {
  const highlighter = await codeHighlighter;
  const html = highlighter.codeToHtml(code, { ...codeThemes, lang: language });
  return (
    <div className={cn("overflow-hidden rounded-md border-[0.5px] bg-card text-foreground", className)}>
      <div className="flex items-center justify-between min-h-9 border-b-[0.5px] px-3">
        <div className="flex items-center gap-2">
          {filename && <span className="font-mono text-xs text-muted-foreground">{filename}</span>}
        </div>
        <CopyButton value={code} label="Copy code" showLabel />
      </div>
      <div
        className="[&>pre]:overflow-x-auto [&>pre]:p-3 [&>pre]:font-mono [&>pre]:text-[13px] [&>pre]:leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
