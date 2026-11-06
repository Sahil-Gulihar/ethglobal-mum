"use client";

import { useEffect, useState } from "react";
import { formatUsdt, type Product } from "@/lib/catalog";
import { useCart } from "./cart";
import { ProductArt } from "./product-art";

export function ProductCard({ product, index }: { product: Product; index: number }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1800);
    return () => clearTimeout(t);
  }, [added]);

  return (
    <article className="animate-rise group flex min-w-0 flex-col" style={{ animationDelay: `${80 + index * 70}ms` }}>
      <div
        className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-[3px]"
        style={{ background: product.tone }}
      >
        {product.badge && (
          <span className="absolute left-3 top-3 text-[11.5px] font-medium tracking-[0.01em] text-ink-soft md:left-4 md:top-4">
            {product.badge}
          </span>
        )}
        <ProductArt
          art={product.art}
          className="size-[88%] transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-[1.035]"
        />
      </div>

      <div className="flex flex-1 flex-col pt-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
          <h3 className="font-display text-[19px] leading-snug tracking-[-0.01em] md:text-[21px]">{product.name}</h3>
          <p className="shrink-0 text-[14px] tabular-nums text-ink">
            {formatUsdt(product.priceCents)} <span className="text-muted">USDT</span>
          </p>
        </div>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{product.tagline}</p>

        <button
          type="button"
          onClick={() => {
            add(product.id);
            setAdded(true);
          }}
          aria-label={`Add ${product.name} to cart`}
          className={`mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[4px] border text-[14px] transition-colors duration-150 active:translate-y-px ${
            added
              ? "border-ink bg-ink text-paper"
              : "border-line-strong text-ink hover:border-ink hover:bg-ink hover:text-paper"
          }`}
        >
          {added ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
              Added
            </>
          ) : (
            "Add to cart"
          )}
        </button>
        <span className="sr-only" role="status" aria-live="polite">
          {added ? `${product.name} added to cart` : ""}
        </span>
      </div>
    </article>
  );
}
