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
    <div className="flex min-w-0 flex-col gap-4 min-[721px]:gap-3">
      <AutoRefresh active intervalMs={5000} />
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${m.name}. Here’s an overview of your store.`}
        actions={
          <Link href="/dashboard/analytics" className={buttonVariants({ variant: "outline" })}>
            View analytics <Icon name="arrowRight" />
          </Link>
        }
      />

      <section aria-label="Summary" className="grid grid-cols-2 border-y border-border lg:grid-cols-4 [&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+3)]:border-t-0">
        <StatCard label="Gross volume" value={formatAmount(stats.volume)} unit="USDT" hint={`Net ${formatAmount(stats.net)} USDT after refunds`} />
        <StatCard label="Payments" value={String(stats.count)} hint="Verified onchain settlements" />
        <StatCard label="Refunded" value={formatAmount(stats.refunded)} unit="USDT" hint={`${stats.refundedCount} payment${stats.refundedCount === 1 ? "" : "s"} refunded`} />
        <div className="flex flex-col gap-1.5 border-l border-border px-4 py-3 sm:px-5">
          <p className="text-xs font-medium text-muted-foreground">Payout wallet</p>
          {m.payoutAddress ? (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-sm font-semibold break-all">{shortAddr(m.payoutAddress, 8, 6)}</span>
              <ExplorerLink address={m.payoutAddress} label="View on explorer" />
            </div>
          ) : (
            <Link href="/dashboard/settings" className="inline-flex w-fit items-center gap-1 rounded text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
              Add a payout wallet <Icon name="arrowRight" className="size-3.5" />
            </Link>
          )}
        </div>
      </section>

      {showOnboarding && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-4 py-2">
          <p className="text-sm font-medium">
            Finish setting up <span className="ml-2 font-normal text-muted-foreground">{ob.completed} of {ob.total} complete</span>
          </p>
          <Link href="/dashboard/setup" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Continue setup <Icon name="arrowRight" />
          </Link>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between !py-2">
          <CardTitle>Recent payments</CardTitle>
          <Link href="/dashboard/payments" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            View all <Icon name="arrowRight" />
          </Link>
        </CardHeader>
        <CardContent className="px-0 pb-2 [&_td]:py-1.5">
          <PaymentsTable rows={recent} />
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint?: string }) {
  return (
    <div className="border-border px-4 py-3 even:border-l sm:px-5 lg:border-l lg:first:border-l-0">
      <div className="flex flex-col gap-1.5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-[28px] leading-none font-light tracking-tight tabular wrap-anywhere">
          {value} {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
