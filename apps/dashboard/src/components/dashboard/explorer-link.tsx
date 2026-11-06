import { explorerAddress, explorerTx } from "@whitechain-commerce/core";
import { Icon } from "@/components/icons";
import { cn, shortAddr, shortHash } from "@/lib/utils";

export function ExplorerLink({ hash, address, label, className }: { hash?: string | null; address?: string | null; label?: string; className?: string }) {
  const value = hash ?? address;
  if (!value) return <span className="text-muted-foreground">—</span>;
  const href = hash ? explorerTx(hash) : explorerAddress(value);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn("inline-flex items-center gap-1 rounded font-mono text-xs text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring", className)}
    >
      {label ?? (hash ? shortHash(hash) : shortAddr(value))}
      <Icon name="external" className="size-3" />
      <span className="sr-only">(opens Whitechain explorer)</span>
    </a>
  );
}
