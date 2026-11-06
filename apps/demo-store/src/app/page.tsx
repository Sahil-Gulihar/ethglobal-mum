import Link from "next/link";
import { PRODUCTS, formatUsdt } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { HeroStillLife } from "@/components/hero-still-life";

const INGREDIENTS: [string, string][] = [
  ["Assam CTC leaf", "Upper Assam"],
  ["Green cardamom", "Idukki, Kerala"],
  ["Dried ginger", "Kochi"],
  ["Clove", "Kanyakumari"],
  ["Black pepper", "Wayanad"],
  ["Cinnamon bark", "Sri Lanka"],
];

const STEPS: [string, string][] = [
  ["Connect your wallet", "MetaMask or any browser wallet. No card details, no account to create."],
  ["Approve one transfer", "You send the exact USDT amount on Whitechain, straight to our wallet."],
  ["We pack your order", "Our server waits for a signed confirmation from Whitechain Commerce, then we ship."],
];

export default function ShopPage() {
  const from = Math.min(...PRODUCTS.map((p) => p.priceCents));

  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-[1240px] gap-10 px-5 pb-16 pt-10 md:grid-cols-[1fr_1.05fr] md:items-center md:gap-16 md:px-10 md:pb-24 md:pt-16">
        <div className="animate-rise max-w-xl">
          <p className="text-[13px] text-muted">Small-batch masala chai, blended in Mumbai</p>
          <h1 className="mt-5 font-display text-[44px] leading-[1.02] tracking-[-0.025em] md:text-[72px]">
            Masala chai, <span className="italic text-masala">made slowly.</span>
          </h1>
          <p className="mt-6 max-w-[34rem] text-[17px] leading-[1.65] text-ink-soft md:text-[18px]">
            Strong Assam leaf and whole spices, pounded the morning we blend them. Pay with USDT from your own
            wallet: it settles straight to us on Whitechain, with no one in between holding your money.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Link
              href="#collection"
              className="inline-flex h-12 items-center rounded-[4px] bg-ink px-6 text-[15px] text-paper transition-colors hover:bg-ink-soft"
            >
              Shop the collection
            </Link>
            <Link href="#paying" className="link text-[15px] text-ink">
              How paying works
            </Link>
          </div>
          <p className="mt-8 text-[13px] text-muted">
            From <span className="tabular-nums">{formatUsdt(from)}</span> USDT · Free shipping on every order
          </p>
        </div>
        <div className="animate-rise [animation-delay:120ms]">
          <HeroStillLife />
        </div>
      </section>

      {/* Collection */}
      <section id="collection" aria-labelledby="collection-title" className="scroll-mt-24 border-t border-line">
        <div className="mx-auto max-w-[1240px] px-5 py-16 md:px-10 md:py-24">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 id="collection-title" className="font-display text-[34px] leading-tight tracking-[-0.02em] md:text-[44px]">
                The collection
              </h2>
              <p className="mt-2 max-w-md text-[15px] text-muted">Four things for a good cup, and nothing else.</p>
            </div>
            <p className="text-[13px] text-muted">Prices in USDT, shipping included</p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-12 md:mt-12 lg:grid-cols-4 lg:gap-x-6">
            {PRODUCTS.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* The blend */}
      <section aria-labelledby="blend-title" className="bg-bone/70">
        <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-16 md:grid-cols-[1.2fr_1fr] md:gap-20 md:px-10 md:py-24">
          <div>
            <h2 id="blend-title" className="text-[13px] text-muted">
              What goes in the tin
            </h2>
            <p className="mt-5 font-display text-[28px] leading-[1.25] tracking-[-0.015em] md:text-[38px]">
              We pound the spices the morning we blend them, so the tin you open smells the way our kitchen does.
            </p>
          </div>
          <dl className="self-end divide-y divide-line-strong/60 border-y border-line-strong/60 text-[14.5px]">
            {INGREDIENTS.map(([name, origin]) => (
              <div key={name} className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-ink">{name}</dt>
                <dd className="text-muted">{origin}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Paying with USDT */}
      <section id="paying" aria-labelledby="paying-title" className="scroll-mt-24">
        <div className="mx-auto max-w-[1240px] px-5 py-16 md:px-10 md:py-24">
          <div className="grid gap-10 md:grid-cols-[1fr_2.2fr] md:gap-16">
            <div>
              <h2 id="paying-title" className="font-display text-[30px] leading-tight tracking-[-0.02em] md:text-[36px]">
                Paying with USDT
              </h2>
              <p className="mt-3 max-w-xs text-[14.5px] leading-relaxed text-muted">
                Your payment goes from your wallet to ours. Neither we nor Whitechain Commerce ever hold your funds.
              </p>
            </div>
            <ol className="grid gap-8 sm:grid-cols-3 sm:gap-8">
              {STEPS.map(([title, body], i) => (
                <li key={title} className="border-t border-ink/80 pt-5">
                  <p className="font-display text-[15px] italic text-masala tabular-nums">{i + 1}</p>
                  <p className="mt-2 text-[16px] font-medium text-ink">{title}</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </>
  );
}
