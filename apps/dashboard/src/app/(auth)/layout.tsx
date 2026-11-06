import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand";
import { Icon } from "@/components/icons";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Wordmark />
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">{children}</main>
        <p className="text-xs text-muted-foreground">Testnet preview on Whitechain Sepolia. No real funds.</p>
      </div>
      <aside className="relative hidden overflow-hidden bg-ink text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(59_91_255/0.55),transparent)]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-24 size-[420px] rounded-full bg-[radial-gradient(closest-side,rgb(59_91_255/0.25),transparent)]" />
        <span className="relative inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
          <span aria-hidden className="size-1.5 rounded-full bg-[#5CF2B4]" /> Live on Whitechain Sepolia
        </span>
        <div className="relative flex flex-col gap-8">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance">
            Get paid in USDT. Straight to your wallet, in seconds.
          </h2>
          <ul className="flex flex-col gap-4 text-sm text-white/75">
            {[
              ["shield", "Non-custodial. Funds never touch our contracts."],
              ["zap", "Settles in one block, linked to your order onchain."],
              ["undo", "Full or partial refunds, signed from your payout wallet."],
            ].map(([icon, text]) => (
              <li key={text} className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-white/10">
                  <Icon name={icon as "shield"} className="size-3.5" />
                </span>
                <span className="pt-1">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} Whitechain Commerce</p>
      </aside>
    </div>
  );
}
