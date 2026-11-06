import type { ReactNode } from "react";
import { Wordmark, LogoMark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Icon, type IconName } from "@/components/icons";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-card lg:grid-cols-2">
      <div className="flex flex-col px-6 py-7 sm:px-10 lg:px-12">
        <Wordmark />
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-16">{children}</main>
        <p className="text-xs text-muted-foreground">Payments powered by Whitechain Commerce.</p>
      </div>
      <aside className="hidden p-4 lg:block">
        <div className="flex h-full flex-col justify-between rounded-md border bg-muted p-12">
          <Badge tone="info" className="w-fit" dot>Built for Whitechain</Badge>
          <div className="max-w-md">
            <div className="mb-6"><LogoMark className="size-9" /></div>
            <h2 className="text-[28px] font-medium leading-[1.15] tracking-tight text-foreground">A simpler way to accept stablecoin payments.</h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">Give your customers a familiar checkout and receive USDT directly in your wallet.</p>
            <ul className="mt-10 flex flex-col gap-5 text-sm font-medium text-foreground">
              {[["shield", "Your funds stay in your control"], ["zap", "Onchain settlement"], ["undo", "Refunds linked to the original payment"]].map(([icon, text]) => (
                <li key={text} className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-sm border-[0.5px] bg-card"><Icon name={icon as IconName} className="size-4" /></span>{text}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Whitechain Commerce</p>
        </div>
      </aside>
    </div>
  );
}
