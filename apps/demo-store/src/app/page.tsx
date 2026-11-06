import { PRODUCTS } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";

export default function ShopPage() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-10 pt-14 md:grid-cols-[1.2fr_1fr] md:items-end">
        <div className="animate-rise">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-muted">
            <span className="size-1.5 rounded-full bg-cardamom" /> Brewed in Mumbai since 2026
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-balance md:text-6xl">
            Small-batch chai, <span className="italic text-masala">paid in USDT.</span>
          </h1>
        </div>
        <p className="animate-rise max-w-md text-lg leading-relaxed text-muted text-pretty [animation-delay:80ms]">
          Hand-pounded spices, strong Assam leaf and the cups to drink it from. Check out in seconds with your
          wallet: funds go straight to us on Whitechain, no middleman holding your money.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold">The collection</h2>
          <p className="text-sm text-muted">{PRODUCTS.length} items · prices in USDT</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCTS.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>

        <div className="mt-14 grid gap-4 rounded-3xl border border-line bg-paper p-6 sm:grid-cols-3 sm:p-8">
          {[
            ["Pay from your wallet", "MetaMask or any browser wallet. No card, no account."],
            ["Settled in seconds", "USDT lands directly in our payout wallet on Whitechain."],
            ["Verified fulfilment", "We ship only after a signed, server-verified payment webhook."],
          ].map(([title, body]) => (
            <div key={title}>
              <p className="font-display text-lg font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
