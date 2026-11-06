import { PRODUCTS } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";

export default function ShopPage() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-8 px-6 pb-14 pt-16 md:grid-cols-[1.2fr_1fr] md:items-end md:pt-24">
        <div className="animate-rise">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-medium text-muted">
            <span className="size-1.5 rounded-full bg-cardamom" /> A Whitechain Commerce demo store
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[1.04] tracking-[-0.05em] text-balance md:text-6xl">
            Small-batch chai, <span className="text-muted">paid in USDT.</span>
          </h1>
        </div>
        <p className="animate-rise max-w-md text-base leading-relaxed text-muted text-pretty [animation-delay:80ms]">
          Hand-pounded spices, strong Assam leaf and the cups to drink it from. Pay us directly from your wallet at checkout.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold tracking-tight">The collection</h2>
          <p className="text-sm text-muted">{PRODUCTS.length} items · prices in USDT</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCTS.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>

        <div className="mt-16 grid gap-7 rounded-2xl border border-line bg-paper p-7 sm:grid-cols-3 sm:p-9">
          {[
            ["Pay from your wallet", "MetaMask or any browser wallet. No card, no account."],
            ["Pay in USDT", "Prices are shown in USDT from browsing to checkout."],
            ["See your order status", "Your order page updates when your payment is confirmed."],
          ].map(([title, body]) => (
            <div key={title}>
              <p className="font-display text-base font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
