"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatUsdt } from "@/lib/catalog";
import { useCart } from "./cart";
import { ProductArt } from "./product-art";

export function CartDrawer() {
  const { lines, subtotalCents, open, setOpen, setQuantity, clear } = useCart();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Modal behaviour: move focus in, trap Tab, close on Escape, lock page scroll, restore focus on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setOpen(false);
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [open, setOpen]);

  async function checkout() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only ids + quantities. The server prices the order from its own catalog.
        body: JSON.stringify({ items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not start checkout");
      clear();
      setOpen(false);
      router.push(`/checkout/${json.orderId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout");
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal aria-label="Your cart">
      <button aria-label="Close cart" tabIndex={-1} className="animate-fade absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
      <aside ref={panelRef} className="animate-drawer absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-paper shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="font-display text-2xl font-semibold">Your cart</h2>
          <button
            ref={closeRef}
            onClick={() => setOpen(false)}
            className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-cream hover:text-ink"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ProductArt art="cup" className="size-28 opacity-80" />
            <p className="font-display text-xl">Your cup is empty</p>
            <p className="text-sm text-muted">Add a tin of masala chai to get brewing.</p>
          </div>
        ) : (
          <ul className="flex-1 divide-y divide-line overflow-y-auto px-6">
            {lines.map(({ product, quantity }) => (
              <li key={product.id} className="flex gap-4 py-5">
                <div className="grid size-20 shrink-0 place-items-center rounded-2xl" style={{ background: product.tone }}>
                  <ProductArt art={product.art} className="size-16" />
                </div>
                <div className="flex flex-1 flex-col">
                  <div className="flex justify-between gap-3">
                    <p className="font-medium">{product.name}</p>
                    <p className="font-medium tabular-nums">{formatUsdt(product.priceCents * quantity)}</p>
                  </div>
                  <p className="text-sm text-muted">{formatUsdt(product.priceCents)} USDT each</p>
                  <div className="mt-auto flex items-center gap-3 pt-2">
                    <div className="inline-flex items-center rounded-full border border-line">
                      <button
                        className="grid size-8 place-items-center rounded-full text-lg text-muted hover:text-ink"
                        onClick={() => setQuantity(product.id, quantity - 1)}
                        aria-label={`Decrease ${product.name}`}
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm tabular-nums">{quantity}</span>
                      <button
                        className="grid size-8 place-items-center rounded-full text-lg text-muted hover:text-ink"
                        onClick={() => setQuantity(product.id, quantity + 1)}
                        aria-label={`Increase ${product.name}`}
                      >
                        +
                      </button>
                    </div>
                    <button
                      className="text-sm text-muted underline-offset-4 hover:text-masala hover:underline"
                      onClick={() => setQuantity(product.id, 0)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-line bg-cream/60 px-6 py-5">
          <div className="flex items-baseline justify-between">
            <span className="text-muted">Subtotal</span>
            <span className="font-display text-2xl font-semibold tabular-nums">
              {formatUsdt(subtotalCents)} <span className="text-base font-normal text-muted">USDT</span>
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">Free shipping. Final total is calculated by our server.</p>
          {error && (
            <p className="mt-3 rounded-xl bg-masala/10 px-3 py-2 text-sm text-masala-dark" role="alert">
              {error}
            </p>
          )}
          <button
            disabled={lines.length === 0 || pending}
            onClick={checkout}
            className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-full bg-masala text-base font-semibold text-cream shadow-[0_8px_24px_-8px_rgba(181,72,42,0.6)] transition hover:bg-masala-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {pending ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-cream/40 border-t-cream" />
                Creating secure checkout…
              </>
            ) : (
              <>
                <UsdtIcon /> Checkout with USDT
              </>
            )}
          </button>
          <p className="mt-3 text-center text-xs text-muted">Non-custodial · Whitechain Sepolia · powered by Whitechain Commerce</p>
        </div>
      </aside>
    </div>
  );
}

export function UsdtIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#26A17B" />
      <path
        d="M13.3 10.4V8.9h3.4V6.6H7.3v2.3h3.4v1.5c-2.8.1-4.9.7-4.9 1.4s2.1 1.3 4.9 1.4v4.9h2.6v-4.9c2.8-.1 4.9-.7 4.9-1.4s-2.1-1.3-4.9-1.4Zm0 2.3c-.1 0-.6.1-1.3.1s-1.2 0-1.3-.1c-2.4-.1-4.2-.5-4.2-1s1.8-.9 4.2-1v1.6c.2 0 .7.1 1.3.1.7 0 1.1 0 1.3-.1v-1.6c2.4.1 4.2.5 4.2 1s-1.8.9-4.2 1Z"
        fill="#fff"
      />
    </svg>
  );
}
