import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatUsdt } from "@/lib/catalog";
import { readStore } from "@/lib/db";
import { getProduct } from "@/lib/catalog";
import { ProductArt } from "@/components/product-art";
import { Pay } from "./pay";

export default async function CheckoutPage({ params }: PageProps<"/checkout/[orderId]">) {
  const { orderId } = await params;
  const order = (await readStore()).orders[orderId];
  if (!order?.sessionId) notFound();
  if (order.status !== "pending") redirect(`/orders/${order.id}`);

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[1fr_460px] lg:gap-12">
      <section className="animate-rise order-2 lg:order-1">
        <Link href="/" className="text-sm text-muted hover:text-ink">
          ← Continue shopping
        </Link>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">Checkout</h1>
        <p className="mt-2 text-muted">
          Order <span className="font-mono text-sm text-ink">{order.id}</span>
        </p>

        <div className="mt-8 rounded-3xl border border-line bg-paper">
          <ul className="divide-y divide-line">
            {order.items.map((item) => {
              const product = getProduct(item.productId);
              return (
                <li key={item.productId} className="flex items-center gap-4 p-5">
                  <div
                    className="grid size-16 shrink-0 place-items-center rounded-2xl"
                    style={{ background: product?.tone ?? "#f3e7d3" }}
                  >
                    {product && <ProductArt art={product.art} className="size-12" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted">
                      {item.quantity} × {formatUsdt(item.unitPriceCents)} USDT
                    </p>
                  </div>
                  <p className="font-medium tabular-nums">{formatUsdt(item.unitPriceCents * item.quantity)}</p>
                </li>
              );
            })}
          </ul>
          <div className="space-y-2 border-t border-line p-5 text-sm">
            <div className="flex justify-between text-muted">
              <span>Shipping</span>
              <span>Free</span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="font-medium">Total</span>
              <span className="font-display text-2xl font-semibold tabular-nums">{order.total} USDT</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3 rounded-2xl bg-cardamom/10 p-4 text-sm leading-relaxed text-ink/80">
          <span aria-hidden className="text-cardamom">●</span>
          <p>
            Your payment goes directly from your wallet to Chai &amp; Co. on Whitechain. Neither we nor Whitechain
            Commerce ever hold your funds. We ship once our server receives a signed payment confirmation.
          </p>
        </div>
      </section>

      <section className="order-1 lg:order-2 lg:pt-12">
        <div className="lg:sticky lg:top-24">
          <Pay orderId={order.id} sessionId={order.sessionId} />
        </div>
      </section>
    </div>
  );
}
