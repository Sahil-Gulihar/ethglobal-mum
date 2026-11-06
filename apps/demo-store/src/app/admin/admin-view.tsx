"use client";

import Link from "next/link";
import type { Order, WebhookLogEntry } from "@/lib/types";
import { StatusPill } from "../orders/[id]/order-status";
import { shortHash, timeAgo, usePoll } from "@/components/use-poll";

type Payload = { orders: Order[]; events: WebhookLogEntry[] };

export function AdminView() {
  const { data } = usePoll<Payload>("/api/admin", () => 2500);
  const orders = data?.orders ?? [];
  const events = data?.events ?? [];
  const revenue = orders
    .filter((o) => o.status !== "pending")
    .reduce((n, o) => n + o.totalCents, 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Merchant back office</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Store admin</h1>
        </div>
        <div className="flex gap-3">
          <Stat label="Orders" value={String(orders.length)} />
          <Stat label="Paid" value={String(orders.filter((o) => o.status !== "pending").length)} />
          <Stat label="Revenue" value={`${(revenue / 100).toFixed(2)} USDT`} />
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold">Orders</h2>
          <div className="overflow-hidden rounded-3xl border border-line bg-paper">
            {!data ? (
              <Skeleton />
            ) : orders.length === 0 ? (
              <Empty>No orders yet. Place one from the shop.</Empty>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">Order</th>
                    <th className="px-5 py-3 font-medium">Total</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Tx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-cream/60">
                      <td className="px-5 py-3">
                        <Link href={`/orders/${o.id}`} className="font-mono text-ink hover:text-masala">
                          {o.id}
                        </Link>
                        <p className="text-xs text-muted">
                          {o.items.reduce((n, i) => n + i.quantity, 0)} items · {timeAgo(o.createdAt)}
                        </p>
                      </td>
                      <td className="px-5 py-3 tabular-nums">
                        {o.total}
                        {o.amountRefunded !== "0.00" && o.amountRefunded !== "0" && (
                          <p className="text-xs text-masala-dark">−{o.amountRefunded} refunded</p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill status={o.status} />
                      </td>
                      <td className="px-5 py-3">
                        {o.payment ? (
                          <a href={o.payment.explorerUrl} target="_blank" rel="noreferrer" className="font-mono text-masala hover:underline">
                            {shortHash(o.payment.txHash)} ↗
                          </a>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold">Webhook log</h2>
            <code className="text-xs text-muted">POST /api/webhooks/whitechain</code>
          </div>
          <div className="overflow-hidden rounded-3xl border border-line bg-paper">
            {!data ? (
              <Skeleton />
            ) : events.length === 0 ? (
              <Empty>No webhook deliveries yet.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {events.map((e, i) => (
                  <li key={`${e.receivedAt}-${i}`} className="p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      {e.verified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-cardamom/15 px-2 py-0.5 text-xs font-semibold text-cardamom">
                          ✓ Signature verified
                        </span>
                      ) : e.setupError ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-saffron/20 px-2 py-0.5 text-xs font-semibold text-saffron">
                          ⚠ Store setup error · 500
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-masala/15 px-2 py-0.5 text-xs font-semibold text-masala-dark">
                          ✗ Signature rejected · 400
                        </span>
                      )}
                      {e.duplicate && (
                        <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-medium">Duplicate · deduped</span>
                      )}
                      {e.type && <code className="font-mono text-xs">{e.type}</code>}
                      <span className="ml-auto text-xs text-muted">{timeAgo(e.receivedAt)}</span>
                    </div>
                    <p className="mt-2 text-ink/80">{e.outcome}</p>
                    {e.eventId && <p className="mt-1 font-mono text-xs text-muted">{e.eventId}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-display text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-muted">{children}</p>;
}

function Skeleton() {
  return (
    <div className="space-y-3 p-5" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-10 animate-pulse rounded-xl bg-line/50" />
      ))}
    </div>
  );
}
