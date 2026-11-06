import type { Metadata } from "next";
import Link from "next/link";
import { requireMerchant } from "@/lib/auth";
import { listPayments, onboardingState, paymentStats } from "./_lib/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { PaymentsTable } from "@/components/dashboard/payments-table";
import { ExplorerLink } from "@/components/dashboard/explorer-link";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { formatAmount, shortAddr } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

export default async function DashboardHome() {
  const m = await requireMerchant();
  const [stats, recent, ob] = await Promise.all([paymentStats(m.id), listPayments(m.id, 3), onboardingState(m)]);
  const showOnboarding = ob.completed < ob.total;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AutoRefresh active intervalMs={5000} />
      <PageHeader
        title="Dashboard"
        description={`Payment activity for ${m.name}.`}
        actions={
          <Link href="/dashboard/analytics" className={buttonVariants({ variant: "outline" })}>
            View analytics <Icon name="arrowRight" />
          </Link>
        }
      />

      <section aria-label="Settlement summary" className="grid min-w-0 gap-6 border-y border-border py-6 md:grid-cols-2 md:gap-10">
        <div className="flex min-w-0 flex-col justify-center">
          <h2 className="text-sm font-medium text-muted-foreground">Net USDT received</h2>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
            <span className="text-5xl font-medium leading-none tracking-tight tabular wrap-anywhere sm:text-6xl">{formatAmount(stats.net)}</span>
            <span className="text-sm font-medium">USDT</span>
          </p>
          <p className="mt-3 text-sm text-muted-foreground">All time, after refunds</p>
        </div>
        <dl className="divide-y divide-border border-t border-border md:border-t-0">
          <StatRow label="Gross volume" value={`${formatAmount(stats.volume)} USDT`} />
          <StatRow label="Verified payments" value={String(stats.count)} />
          <StatRow label="Refunded" value={`${formatAmount(stats.refunded)} USDT`} detail={`${stats.refundedCount} payment${stats.refundedCount === 1 ? "" : "s"}`} />
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm">
            <dt className="text-muted-foreground">Payout wallet</dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              {m.payoutAddress ? (
                <>
                  <span className="font-mono text-xs font-medium">{shortAddr(m.payoutAddress, 8, 6)}</span>
                  <ExplorerLink address={m.payoutAddress} label="View on explorer" />
                </>
              ) : (
                <Link href="/dashboard/settings" className="rounded-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                  Add a payout wallet
                </Link>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {showOnboarding && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted px-5 py-3">
          <p className="text-sm font-medium">
            Finish setting up <span className="ml-2 font-normal text-muted-foreground">{ob.completed} of {ob.total} complete</span>
          </p>
          <Link href="/dashboard/setup" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Continue setup <Icon name="arrowRight" />
          </Link>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 !py-4">
          <CardTitle>Recent payments</CardTitle>
          <Link href="/dashboard/payments" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            View all <Icon name="arrowRight" />
          </Link>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <PaymentsTable rows={recent} />
        </CardContent>
      </Card>
    </div>
  );
}

function StatRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-medium tabular wrap-anywhere">{value}</span>
        {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
      </dd>
    </div>
  );
}
