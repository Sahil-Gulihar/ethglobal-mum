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
      } else if (!e.shiftKey && (document.activeElement === last || !panelRef.current.contains(document.activeElement))) {
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

  const count = lines.reduce((n, l) => n + l.quantity, 0);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="cart-title">
      <button
        aria-label="Close cart"
        tabIndex={-1}
        className="animate-fade absolute inset-0 cursor-default bg-ink/35 backdrop-blur-[2px]"
        onClick={() => setOpen(false)}
      />
      <aside
        ref={panelRef}
        className="animate-drawer absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col bg-paper shadow-[0_0_60px_rgba(36,24,15,0.18)]"
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-5 md:h-[72px] md:px-7">
          <h2 id="cart-title" className="font-display text-[24px] tracking-[-0.01em]">
            Your cart
            {count > 0 && <span className="ml-2 font-sans text-[14px] text-muted tabular-nums">({count})</span>}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            className="-mr-2 grid size-11 place-items-center rounded-[4px] text-ink-soft transition-colors hover:bg-ink/[0.05] hover:text-ink"
            aria-label="Close cart"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <p className="font-display text-[22px]">Your cart is empty</p>
            <p className="mt-2 max-w-[18rem] text-[14px] leading-relaxed text-muted">
              Start with a tasting sachet, or go straight for the tin.
            </p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="mt-6 inline-flex h-11 items-center rounded-[4px] border border-line-strong px-5 text-[14px] transition-colors hover:border-ink"
            >
              Browse the collection
            </button>
          </div>
        ) : (
          <ul className="flex-1 divide-y divide-line overflow-y-auto px-5 md:px-7" aria-label="Items in your cart">
            {lines.map(({ product, quantity }) => (
              <li key={product.id} className="flex gap-4 py-5">
                <div
                  className="grid size-[84px] shrink-0 place-items-center rounded-[3px]"
                  style={{ background: product.tone }}
                >
                  <ProductArt art={product.art} className="size-[68px]" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-display text-[17px] leading-snug">{product.name}</p>
                    <p className="shrink-0 text-[14px] tabular-nums">{formatUsdt(product.priceCents * quantity)}</p>
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">
                    <span className="tabular-nums">{formatUsdt(product.priceCents)}</span> USDT each
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="inline-flex items-center rounded-[4px] border border-line-strong" role="group" aria-label={`Quantity of ${product.name}`}>
                      <button
                        type="button"
                        className="grid size-9 place-items-center text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
                        onClick={() => setQuantity(product.id, quantity - 1)}
                        aria-label={quantity === 1 ? `Remove ${product.name}` : `Decrease ${product.name}`}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                          <path d="M2 6h8" stroke="currentColor" strokeWidth="1.4" />
                        </svg>
                      </button>
                      <span className="w-7 text-center text-[14px] tabular-nums" aria-live="polite">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        className="grid size-9 place-items-center text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
                        onClick={() => setQuantity(product.id, quantity + 1)}
                        disabled={quantity >= 20}
                        aria-label={`Increase ${product.name}`}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                          <path d="M2 6h8M6 2v8" stroke="currentColor" strokeWidth="1.4" />
                        </svg>
                      </button>
                    </div>
                    <button
                      type="button"
                      className="link text-[13px] text-muted hover:text-ink"
                      onClick={() => setQuantity(product.id, 0)}
                      aria-label={`Remove ${product.name} from cart`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {lines.length > 0 && (
          <div className="border-t border-line px-5 pb-6 pt-5 md:px-7">
            <dl className="space-y-2 text-[14px]">
              <div className="flex justify-between text-muted">
                <dt>Shipping</dt>
                <dd>Free</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-ink">Subtotal</dt>
                <dd className="text-[20px] tabular-nums">
                  {formatUsdt(subtotalCents)} <span className="text-[14px] text-muted">USDT</span>
                </dd>
              </div>
            </dl>
            {error && (
              <p className="mt-4 rounded-[4px] border border-masala/25 bg-masala/[0.06] px-3 py-2 text-[13.5px] text-masala-dark" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={checkout}
              className="mt-5 flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[4px] bg-ink text-[15px] text-paper transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-[1.5px] border-paper/30 border-t-paper" aria-hidden />
                  Preparing checkout
                </>
              ) : (
                <>
                  <UsdtIcon className="size-[18px]" /> Check out with USDT
                </>
              )}
            </button>
            <p className="mt-3 text-center text-[12.5px] leading-relaxed text-muted">
              Totals are confirmed by our server. Payments by Whitechain Commerce.
            </p>
          </div>
        )}
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
