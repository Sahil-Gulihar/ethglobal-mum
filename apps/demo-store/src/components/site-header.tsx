"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./cart";
import { CartDrawer } from "./cart-drawer";
import { Logo } from "./logo";

const NAV = [
  { href: "/#collection", label: "Shop" },
  { href: "/#paying", label: "Paying with USDT" },
  { href: "/admin", label: "Store admin" },
];

export function SiteHeader() {
  const { count, setOpen, hydrated } = useCart();
  const pathname = usePathname();

  return (
    <>
      <div className="border-b border-line bg-bone/60 text-center text-[12.5px] text-ink-soft">
        <p className="mx-auto max-w-[1240px] px-5 py-2">
          A demo store on Whitechain Sepolia. Pay with test USDT from your own wallet.
        </p>
      </div>
      <header className="sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur-md backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-6 px-5 md:h-[72px] md:px-10">
          <Link href="/" aria-label="Chai & Co. home" className="-m-1 p-1">
            <Logo />
          </Link>
          <div className="flex items-center gap-1 md:gap-8">
            <nav aria-label="Main" className="hidden items-center gap-7 text-[14px] md:flex">
              {NAV.map((item) => {
                const active = item.href === "/admin" && pathname.startsWith("/admin");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`transition-colors hover:text-ink ${active ? "text-ink" : "text-ink-soft"}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`Open cart, ${count} ${count === 1 ? "item" : "items"}`}
              className="group -mr-2 inline-flex h-11 items-center gap-2.5 rounded-[4px] px-2 text-[14px] text-ink transition-colors hover:bg-ink/[0.04]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path d="M5.5 8h13l-1 12.5h-11L5.5 8Z" strokeLinejoin="round" />
                <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
              </svg>
              <span>Cart</span>
              <span
                key={count}
                className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-medium tabular-nums transition-colors ${
                  count > 0 ? "animate-bump bg-ink text-paper" : "bg-ink/[0.07] text-ink-soft"
                } ${hydrated ? "" : "opacity-0"}`}
              >
                {count}
              </span>
            </button>
          </div>
        </div>
      </header>
      <CartDrawer />
    </>
  );
}
