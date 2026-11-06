import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-2">
      <div className="flex flex-col px-6 py-7 sm:px-10 lg:px-12">
        <Wordmark />
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-16">{children}</main>
        <p className="text-xs text-muted-foreground">Payments powered by White Money.</p>
      </div>
      <aside className="hidden border-l border-border bg-card lg:block">
        <div className="flex h-full flex-col justify-between p-12">
          <Badge tone="info" className="w-fit">Built for Whitechain</Badge>
          <div className="max-w-md">
            <h2 className="text-[2rem] font-medium leading-tight tracking-tight">A simpler way to accept stablecoin payments.</h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">Give your customers a familiar checkout and receive USDT directly in your wallet.</p>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} White Money</p>
        </div>
      </aside>
    </div>
  );
}
