import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatUsdt, getProduct } from "@/lib/catalog";
import { readStore } from "@/lib/db";
import type { Order } from "@/lib/types";
import { ProductArt } from "@/components/product-art";
import { Pay } from "./pay";

export const metadata = { title: "Checkout · Chai & Co." };

export default async function CheckoutPage({ params }: PageProps<"/checkout/[orderId]">) {
  const { orderId } = await params;
  const order = (await readStore()).orders[orderId];
  if (!order?.sessionId) notFound();
  if (order.status !== "pending") redirect(`/orders/${order.id}`);

  const count = order.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div className="mx-auto max-w-[1240px] px-5 pb-20 pt-8 md:px-10 md:pb-28 md:pt-12">
      <Link href="/" className="inline-flex items-center gap-1.5 text-[14px] text-ink-soft transition-colors hover:text-ink">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M10 3L5 8l5 5" />
        </svg>
        Back to shop
      </Link>

      <div className="mt-6 flex flex-col gap-1 md:mt-8 md:flex-row md:items-baseline md:justify-between">
        <h1 className="font-display text-[36px] leading-tight tracking-[-0.02em] md:text-[48px]">Checkout</h1>
        <p className="text-[13px] text-muted">
          Order <span className="font-mono text-ink-soft">{order.id}</span>
        </p>
      </div>

      {/* Mobile: a collapsible summary above the payment step. */}
      <details className="group mt-6 border-y border-line lg:hidden">
        <summary className="flex h-14 cursor-pointer list-none items-center justify-between gap-4 text-[14px] [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2 text-ink">
            <span className="group-open:hidden">Show order summary</span>
            <span className="hidden group-open:inline">Hide order summary</span>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden className="transition-transform group-open:rotate-180">
              <path d="M3 6l5 5 5-5" />
            </svg>
          </span>
          <span className="tabular-nums">
            {order.total} <span className="text-muted">USDT</span>
          </span>
        </summary>
        <div className="pb-6">
          <Summary order={order} />
        </div>
      </details>

      <div className="mt-8 grid gap-12 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-20">
        <section aria-labelledby="pay-title" className="min-w-0">
          <div className="flex items-baseline gap-3">
            <h2 id="pay-title" className="font-display text-[24px] tracking-[-0.01em]">
              Payment
            </h2>
            <p className="text-[13px] text-muted">USDT on Whitechain Sepolia</p>
          </div>
          <p className="mt-2 max-w-[34rem] text-[14.5px] leading-relaxed text-muted">
            Connect a browser wallet and approve one transfer of {order.total} USDT. The amount is locked for this order.
          </p>

          <div className="mt-6 max-w-[400px] [&_.wcc-root]:mx-0">
            <Pay orderId={order.id} sessionId={order.sessionId} />
          </div>

          <ul className="mt-8 max-w-[34rem] space-y-3 border-t border-line pt-6 text-[13.5px] leading-relaxed text-ink-soft">
            <Assurance>Your USDT goes straight from your wallet to Chai &amp; Co. Nobody in between holds it.</Assurance>
            <Assurance>We start packing only after our server receives a signed payment confirmation.</Assurance>
            <Assurance>This is a demo on a test network. Use test USDT only.</Assurance>
          </ul>
        </section>

        <aside aria-labelledby="summary-title" className="hidden lg:block">
          <div className="sticky top-28 rounded-[4px] border border-line bg-paper p-7">
            <h2 id="summary-title" className="flex items-baseline justify-between font-display text-[22px] tracking-[-0.01em]">
              Order summary
              <span className="font-sans text-[13px] text-muted tabular-nums">
                {count} {count === 1 ? "item" : "items"}
              </span>
            </h2>
            <div className="mt-5">
              <Summary order={order} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Summary({ order }: { order: Order }) {
  return (
    <>
      <ul className="space-y-4">
        {order.items.map((item) => {
          const product = getProduct(item.productId);
          return (
            <li key={item.productId} className="flex items-center gap-4">
              <div
                className="relative grid size-16 shrink-0 place-items-center rounded-[3px]"
                style={{ background: product?.tone ?? "#f3e7d3" }}
              >
                {product && <ProductArt art={product.art} className="size-14" />}
                <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] text-paper tabular-nums">
                  {item.quantity}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[16px] leading-snug">{item.name}</p>
                <p className="text-[13px] text-muted">
                  <span className="tabular-nums">{formatUsdt(item.unitPriceCents)}</span> USDT each
                </p>
              </div>
              <p className="text-[14px] tabular-nums">{formatUsdt(item.unitPriceCents * item.quantity)}</p>
            </li>
          );
        })}
      </ul>
      <dl className="mt-6 space-y-2 border-t border-line pt-5 text-[14px]">
        <div className="flex justify-between text-muted">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{order.total}</dd>
        </div>
        <div className="flex justify-between text-muted">
          <dt>Shipping</dt>
          <dd>Free</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <dt className="text-ink">Total</dt>
          <dd className="text-[22px] tabular-nums">
            {order.total} <span className="text-[14px] text-muted">USDT</span>
          </dd>
        </div>
      </dl>
    </>
  );
}

function Assurance({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="mt-[3px] shrink-0 text-cardamom">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
      <span>{children}</span>
    </li>
  );
}
