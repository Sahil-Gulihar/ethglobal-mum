import { explorerAddress, explorerTx } from "@whitechain-commerce/core";
import { Icon } from "@/components/icons";
import { cn, shortAddr, shortHash } from "@/lib/utils";

/** Hash or address linking to the Whitechain explorer. Mono only for the identifier itself; a plain `label` stays sans. */
export function ExplorerLink({ hash, address, label, className }: { hash?: string | null; address?: string | null; label?: string; className?: string }) {
  const value = hash ?? address;
  if (!value) return <span className="text-faint">None</span>;
  const href = hash ? explorerTx(hash) : explorerAddress(value);
  const isIdentifier = !label || label.startsWith("0x");
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={value}
      className={cn(
        "group inline-flex items-center gap-1 rounded-sm text-foreground underline decoration-transparent decoration-1 underline-offset-[3px] transition-[text-decoration-color] duration-150 hover:decoration-current",
        isIdentifier ? "font-mono text-[13px]" : "text-sm font-medium",
        className,
      )}
    >
      {label ?? (hash ? shortHash(hash) : shortAddr(value))}
      <Icon name="external" className="size-3 text-faint transition-colors duration-150 group-hover:text-foreground" />
      <span className="sr-only">(opens Whitechain explorer)</span>
    </a>
  );
}
