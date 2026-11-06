"use client";

import Link from "next/link";
import { formatUsdt } from "@/lib/catalog";
import type { Order } from "@/lib/types";
import { shortHash, timeAgo, usePoll } from "@/components/use-poll";

type Payload = { order: Order };

export function OrderStatusView({ orderId, justPaid = false }: { orderId: string; justPaid?: boolean }) {
  const { data, error } = usePoll<Payload>(`/api/orders/${orderId}`, (d) =>
    !d || d.order.status === "pending" ? 1500 : 5000,
  );

  if (error && !data) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-semibold">We couldn’t load your order</h1>
        <p className="mt-2 text-muted">Check the link or try again in a moment.</p>
        <Link href="/" className="mt-6 inline-block text-masala underline underline-offset-4">
          Back to the shop
        </Link>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24">
        <div className="h-48 animate-pulse rounded-3xl bg-line/50" />
      </div>
    );
  }

  const { order } = data;
  const paid = order.status !== "pending";
  const refunded = order.status === "refunded";
  const partlyRefunded = order.status === "partially_refunded";

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm text-muted">
        Order <span className="font-mono text-ink">{order.id}</span>
      </p>

      {paid ? (
        <div className="animate-rise mt-4 overflow-hidden rounded-3xl border border-cardamom/30 bg-paper">
          <div className="flex items-start gap-4 bg-cardamom/10 p-6">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-cardamom text-cream">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight">
                {refunded ? "Order refunded" : partlyRefunded ? "Partially refunded" : "Payment confirmed"}
              </h1>
              <p className="mt-1 text-ink/70">
                {refunded
                  ? "The full amount was returned to your wallet."
                  : partlyRefunded
                    ? `${order.amountRefunded} USDT was returned to your wallet.`
                    : "Thanks for your order!"}
              </p>
            </div>
          </div>
          <dl className="grid gap-4 p-6 text-sm sm:grid-cols-2">
            <Field label="Amount paid">{order.payment?.amount ?? order.total} USDT</Field>
            <Field label="Status">
              <StatusPill status={order.status} />
            </Field>
            <Field label="Payment details">
              {order.payment ? (
                <a
                  href={order.payment.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-masala underline underline-offset-4 hover:text-masala-dark"
                >
                  View payment ↗
                </a>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Paid from">
              <span className="font-mono">{order.payment ? shortHash(order.payment.payer) : "—"}</span>
            </Field>
            <Field label="Paid">{order.paidAt ? timeAgo(order.paidAt) : "—"}</Field>
          </dl>
        </div>
      ) : (
        <div className="animate-rise mt-4 rounded-3xl border border-line bg-paper p-6">
          <div className="flex items-start gap-4">
            <span className="relative mt-1 grid size-12 shrink-0 place-items-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-saffron/30" />
              <span className="size-4 rounded-full bg-saffron" />
            </span>
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight">
                {justPaid ? "Confirming your payment…" : "Waiting for payment"}
              </h1>
              <p className="mt-1 text-ink/70">
                This page will update when your payment is confirmed.
              </p>
              {!justPaid && (
                <Link
                  href={`/checkout/${order.id}`}
                  className="mt-4 inline-flex rounded-full bg-masala px-4 py-2 text-sm font-semibold text-cream hover:bg-masala-dark"
                >
                  Go to payment
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {order.refunds.length > 0 && (
        <section className="animate-rise mt-6 rounded-3xl border border-line bg-paper p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold">Refunds</h2>
            <p className="text-sm text-muted">{order.amountRefunded} USDT refunded</p>
          </div>
          <ul className="mt-4 divide-y divide-line text-sm">
            {order.refunds.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium">{r.amount} USDT returned to your wallet</p>
                  <p className="text-muted">{timeAgo(r.recordedAt)}</p>
                </div>
                {r.explorerUrl && r.txHash && (
                  <a href={r.explorerUrl} target="_blank" rel="noreferrer" className="text-masala underline underline-offset-4">
                    View refund ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-3xl border border-line bg-paper p-6">
        <h2 className="font-display text-xl font-semibold">Your order</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {order.items.map((i) => (
            <li key={i.productId} className="flex justify-between">
              <span>
                {i.quantity} × {i.name}
              </span>
              <span className="tabular-nums">{formatUsdt(i.unitPriceCents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-line pt-4 font-medium">
          <span>Total</span>
          <span className="tabular-nums">{order.total} USDT</span>
        </div>
      </section>

      <div className="mt-8 flex justify-between text-sm">
        <Link href="/" className="text-muted hover:text-ink">
          ← Back to the shop
        </Link>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 break-all">{children}</dd>
    </div>
  );
}

export function StatusPill({ status }: { status: Order["status"] }) {
  const map = {
    pending: ["Awaiting payment", "bg-saffron/15 text-saffron"],
    paid: ["Paid", "bg-cardamom/15 text-cardamom"],
    partially_refunded: ["Partially refunded", "bg-masala/10 text-masala-dark"],
    refunded: ["Refunded", "bg-ink/10 text-ink"],
  } as const;
  const [label, cls] = map[status];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
