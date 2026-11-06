import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { fromUnits, getRouterAddress } from "@whitechain-commerce/core";
import { requireMerchant } from "@/lib/auth";
import { getPaymentDetail, listPaymentDeliveries } from "../../_lib/queries";
import { DashboardPager, DashboardSections } from "@/components/dashboard/dashboard-pages";
import { pageItems } from "@/lib/dashboard-pages";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ExplorerLink } from "@/components/dashboard/explorer-link";
import { RefundPanel } from "@/components/dashboard/refund-panel";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { CopyButton } from "@/components/ui/copy-button";
import { Icon, type IconName } from "@/components/icons";
import { cn, formatAmount, formatDateTime, shortAddr, shortHash } from "@/lib/utils";

export const metadata: Metadata = { title: "Payment" };

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await requireMerchant();
  const [p, deliveries] = await Promise.all([getPaymentDetail(m.id, id), listPaymentDeliveries(m.id, id)]);
  if (!p) notFound();

  const pendingRefunds = p.refunds.filter((r) => r.status === "pending");
  const payoutChanged = !!m.payoutAddress && m.payoutAddress.toLowerCase() !== p.payout.toLowerCase();

  type Event = { key: string; icon: IconName; title: ReactNode; at: Date; detail?: ReactNode; tone: "done" | "pending" | "failed" };
  const base: Event[] = [
    {
      key: "created",
      icon: "card",
      title: "Checkout session created",
      at: p.sessionCreatedAt,
      detail: <span className="font-mono">{p.sessionId}</span>,
      tone: "done",
    },
    {
      key: "paid",
      icon: "check",
      title: `Payment of ${formatAmount(p.amount)} USDT succeeded`,
      at: p.createdAt,
      detail: (
        <span className="flex flex-wrap items-center gap-x-2">
          Confirmed on Whitechain in block {p.blockNumber} <ExplorerLink hash={p.txHash} />
        </span>
      ),
      tone: "done",
    },
  ];
  const timeline: Event[] = [
    ...base,
    ...p.refunds.map<Event>((r) => ({
      key: r.id,
      icon: "undo",
      title: r.status === "succeeded" ? `Refunded ${formatAmount(r.amount)} USDT` : `Refund of ${formatAmount(r.amount)} USDT requested`,
      at: r.createdAt,
      detail: r.txHash ? <ExplorerLink hash={r.txHash} /> : <span>Waiting for a signature from your payout wallet</span>,
      tone: r.status === "succeeded" ? "done" : "pending",
    })),
    ...deliveries.map<Event>((d) => {
      const webhook = d.eventType === "refund.succeeded" ? "Refund webhook" : "Payment webhook";
      return {
        key: d.id,
        icon: "webhook",
        title:
          d.status === "succeeded"
            ? `${webhook} delivered`
            : d.status === "failed"
              ? `${webhook} failed`
              : `${webhook} ${d.attempts ? "retrying" : "queued"}`,
        at: d.lastAttemptAt ?? d.createdAt,
        detail: (
          <span className="flex flex-wrap items-center gap-x-2">
            {d.lastStatusCode !== null && <span className="font-mono">HTTP {d.lastStatusCode}</span>}
            <span className="max-w-72 truncate" title={d.endpointUrl}>
              {d.endpointUrl}
            </span>
            {d.attempts > 1 && <span>{d.attempts} attempts</span>}
          </span>
        ),
        tone: d.status === "succeeded" ? "done" : d.status === "failed" ? "failed" : "pending",
      };
    }),
  ]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .reverse();

  return (
    <>
      <AutoRefresh active={pendingRefunds.length > 0 || deliveries.some((d) => d.status === "pending")} />
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="tabular">
              {formatAmount(p.amount)} <span className="text-lg font-medium text-muted-foreground">USDT</span>
            </span>
            <StatusBadge status={p.status} />
          </span>
        }
        description={
          <span className="flex min-w-0 flex-wrap items-center gap-1">
            Order{" "}
            <span className="max-w-full truncate font-mono text-foreground" title={p.orderId}>
              {p.orderId}
            </span>{" "}
            · {formatDateTime(p.createdAt)}
          </span>
        }
        actions={
          <RefundPanel
            paymentId={p.id}
            chainPaymentId={p.chainPaymentId as `0x${string}`}
            payout={m.payoutAddress}
            router={getRouterAddress()}
            decimals={p.decimals}
            refundableUnits={p.refundableUnits}
            pending={pendingRefunds.map((r) => ({ id: r.id, amountUnits: r.amountUnits, txHash: r.txHash }))}
          />
        }
      />

      {payoutChanged && (
        <Alert tone="warning">
          This payment settled to {shortAddr(p.payout)}, but your current payout wallet is {shortAddr(m.payoutAddress)}. Refunds are signed from the
          current payout wallet.
        </Alert>
      )}
      {BigInt(p.pendingUnits) > 0n && (
        <Alert tone="info">
          {formatAmount(fromUnits(p.pendingUnits, p.decimals))} USDT of refunds are pending. They complete once signed from your payout wallet and
          confirmed onchain.
        </Alert>
      )}

      <DashboardSections
        sections={[
          {
            label: "Timeline",
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <DashboardPager
                    pages={pageItems(timeline, 2).map((page, index) => (
                      <ol
                        key={index}
                        className="relative flex flex-col gap-3 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-border"
                      >
                        {page.map((e) => (
                          <li key={e.key} className="relative flex gap-4">
                            <span
                              aria-hidden
                              className={cn(
                                "relative z-[1] grid size-8 shrink-0 place-items-center rounded-sm border-[0.5px] bg-card",
                                e.tone === "done"
                                  ? "border-primary/30 text-primary"
                                  : e.tone === "failed"
                                    ? "border-destructive/40 text-destructive"
                                    : "border-warning/40 text-warning",
                              )}
                            >
                              <Icon name={e.icon} className="size-3.5" />
                            </span>
                            <div className="flex min-w-0 flex-col gap-0.5 pt-1">
                              <p className="text-sm font-medium">
                                {e.title} {e.tone === "pending" && <Badge tone="warning">Pending</Badge>}
                              </p>
                              <p className="text-xs text-muted-foreground">{formatDateTime(e.at)}</p>
                              {e.detail && <div className="text-xs text-muted-foreground">{e.detail}</div>}
                            </div>
                          </li>
                        ))}
                      </ol>
                    ))}
                  />
                </CardContent>
              </Card>
            ),
          },
          {
            label: "Details",
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <DashboardPager
                    pages={pageItems(
                      [
                        <Row key="0" label="Amount">
                          {formatAmount(p.amount)} USDT
                        </Row>,
                        <Row key="1" label="Refunded">
                          {formatAmount(p.refunded)} USDT
                        </Row>,
                        <Row key="2" label="Refundable">
                          {formatAmount(fromUnits(p.refundableUnits, p.decimals))} USDT
                        </Row>,
                        <Row key="3" label="Payment ID" copy={p.id}>
                          {" "}
                          <span className="font-mono text-xs">{p.id}</span>{" "}
                        </Row>,
                        <Row key="4" label="Order ID" copy={p.orderId}>
                          {" "}
                          <span className="truncate font-mono text-xs" title={p.orderId}>
                            {p.orderId}
                          </span>{" "}
                        </Row>,
                        <Row key="5" label="Customer">
                          {" "}
                          <ExplorerLink address={p.payer} />{" "}
                        </Row>,
                        <Row key="6" label="Settled to">
                          {" "}
                          <ExplorerLink address={p.payout} />{" "}
                        </Row>,
                        <Row key="7" label="Transaction">
                          {" "}
                          <ExplorerLink hash={p.txHash} />{" "}
                        </Row>,
                        <Row key="8" label="Onchain ID" copy={p.chainPaymentId}>
                          {" "}
                          <span className="font-mono text-xs">{shortHash(p.chainPaymentId)}</span>{" "}
                        </Row>,
                        <Row key="9" label="Chain ID">
                          1874
                        </Row>,
                        ...Object.entries(p.metadata ?? {}).map(([name, value]) => (
                          <Row key={`metadata-${name}`} label={name}>
                            <span className="truncate font-mono text-xs" title={value}>
                              {value}
                            </span>
                            <CopyButton label={`Copy ${name}`} value={value} />
                          </Row>
                        )),
                      ],
                      4,
                    ).map((page, index) => (
                      <dl key={index} className="flex flex-col divide-y text-sm">
                        {page}
                      </dl>
                    ))}
                  />
                </CardContent>
              </Card>
            ),
          },
        ]}
      />
    </>
  );
}

function Row({ label, children, copy }: { label: string; children: ReactNode; copy?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1 truncate text-right tabular">
        {children}
        {copy && <CopyButton value={copy} label={`Copy ${label}`} className="-my-1 h-7 min-w-7" />}
      </dd>
    </div>
  );
}
