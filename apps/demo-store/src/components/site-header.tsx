"use client";

import Link from "next/link";
import { useCart } from "./cart";
import { CartDrawer } from "./cart-drawer";
import { Logo } from "./logo";

export function SiteHeader() {
  const { count, setOpen } = useCart();
  return (
    <>
      <div className="bg-ink text-center text-[13px] text-cream/90">
        <p className="mx-auto max-w-6xl px-6 py-2">
          Now accepting <span className="font-semibold text-saffron">USDT on Whitechain</span>: pay straight from
          your wallet, settled to us in seconds.
        </p>
      </div>
      <header className="sticky top-0 z-30 border-b border-line bg-cream/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
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
              className="ml-2 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 font-medium text-cream transition hover:bg-ink/90 active:scale-[0.98]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 7h12l-1 13H7L6 7Z" />
                <path d="M9 7a3 3 0 0 1 6 0" />
              </svg>
              Cart
              <span className="grid min-w-5 place-items-center rounded-full bg-saffron px-1.5 text-xs font-semibold text-ink tabular-nums">
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
