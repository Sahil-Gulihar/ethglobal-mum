"use client";

import { formatUsdt, type Product } from "@/lib/catalog";
import { useCart } from "./cart";
import { ProductArt } from "./product-art";

export function ProductCard({ product, index }: { product: Product; index: number }) {
  const { add } = useCart();
  return (
    <article
      className="animate-rise group flex flex-col overflow-hidden rounded-2xl border border-line bg-paper transition hover:border-ink/25 hover:shadow-[0_12px_30px_-20px_rgba(20,30,24,0.18)]"
      style={{ animationDelay: `${120 + index * 60}ms` }}
    >
      <div className="relative grid aspect-square place-items-center" style={{ background: product.tone }}>
        {product.badge && (
          <span className="absolute left-4 top-4 rounded-full bg-paper/90 px-2.5 py-1 text-xs font-semibold text-ink">
            {product.badge}
          </span>
        )}
        <ProductArt art={product.art} className="size-3/4 transition duration-500 group-hover:scale-[1.04]" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-5">
        <h3 className="font-display text-base font-semibold leading-snug">{product.name}</h3>
        <p className="text-sm text-muted">{product.tagline}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink/70">{product.description}</p>
        <div className="mt-auto flex items-center justify-between pt-5">
          <p className="font-semibold tabular-nums">
            {formatUsdt(product.priceCents)} <span className="text-sm font-normal text-muted">USDT</span>
          </p>
          <button
            onClick={() => add(product.id)}
            aria-label={`Add ${product.name} to cart`}
            className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-semibold transition hover:border-ink hover:bg-ink hover:text-cream active:scale-[0.97]"
          >
            Add to cart
          </button>
        </div>
      </div>
    </article>
  );
}
