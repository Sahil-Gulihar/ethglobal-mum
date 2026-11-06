"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShoppingBag01Icon } from "@hugeicons/core-free-icons";
import { useCart } from "./cart";
import { CartDrawer } from "./cart-drawer";
import { Logo } from "./logo";

export function SiteHeader() {
  const { count, setOpen } = useCart();
  return (
    <>
      <div className="bg-paper text-center text-[13px] text-muted">
        <p className="mx-auto max-w-6xl px-6 py-2">
          Pay with <span className="font-semibold text-ink">USDT</span> straight from your wallet.
        </p>
      </div>
      <header className="sticky top-0 z-30 border-b border-line bg-cream">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-6">
          <Link href="/" aria-label="Chai & Co. home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/" className="rounded-full px-3 py-2 text-muted transition hover:text-ink">
              Shop
            </Link>
            <Link href="/admin" className="rounded-full px-3 py-2 text-muted transition hover:text-ink">
              Store admin
            </Link>
            <button
              onClick={() => setOpen(true)}
              className="ml-2 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 font-semibold text-cream transition hover:bg-ink/90 active:scale-[0.98]"
            >
              <HugeiconsIcon icon={ShoppingBag01Icon} size={16} strokeWidth={1.8} aria-hidden />
              Cart
              <span className="grid min-w-5 place-items-center rounded-full bg-cream/15 px-1.5 text-xs font-semibold text-cream tabular-nums">
                {count}
              </span>
            </button>
          </nav>
        </div>
      </header>
      <CartDrawer />
    </>
  );
}
