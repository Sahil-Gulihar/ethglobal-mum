import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthShowcase } from "@/components/auth/auth-showcase";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex min-w-0 flex-col px-6 py-6 sm:px-10 sm:py-8">
        <header>
          <Wordmark />
        </header>
        <main className="mx-auto flex w-full max-w-[360px] flex-1 flex-col justify-center py-12">{children}</main>
        <footer className="flex items-center justify-between gap-4">
          <p className="text-[13px] leading-5 text-muted-foreground">Testnet preview on Whitechain Sepolia. No real funds.</p>
          <ThemeToggle />
        </footer>
      </div>

      <aside className="relative hidden min-w-0 border-l border-border bg-surface-2 lg:block">
        <div className="sticky top-0 flex h-dvh flex-col overflow-hidden">
          <div className="max-w-[460px] px-12 pt-12">
            <p className="text-xl leading-[26px] font-[450] tracking-[-0.02em] text-foreground">
              USDT payments, settled to your own wallet
            </p>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">
              Buyers pay on Whitechain Sepolia. Each payment is linked to its order onchain, and refunds are signed from your payout wallet.
            </p>
          </div>
          <div aria-hidden className="relative mt-4 min-h-0 flex-1">
            <AuthShowcase />
          </div>
        </div>
      </aside>
    </div>
  );
}
