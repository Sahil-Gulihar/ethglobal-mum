import type { Metadata } from "next";
import Link from "next/link";
import { requireMerchant } from "@/lib/auth";
import { env } from "@/lib/env";
import { listPayments, onboardingState, paymentStats } from "./_lib/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { OnboardingChecklist } from "@/components/dashboard/onboarding";
import { PaymentsTable } from "@/components/dashboard/payments-table";
import { ExplorerLink } from "@/components/dashboard/explorer-link";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { CodeBlock } from "@/components/code-block";
import { clientSnippet, serverSnippet } from "@/components/snippets";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { formatAmount, shortAddr } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

export default async function DashboardHome() {
  const m = await requireMerchant();
  const [stats, recent, ob] = await Promise.all([paymentStats(m.id), listPayments(m.id, 5), onboardingState(m)]);
  const showOnboarding = ob.completed < ob.total;

  return (
    <>
      <AutoRefresh active intervalMs={5000} />
      <PageHeader
        title={`Welcome, ${m.name}`}
        description="Here’s how your store is doing on Whitechain."
        actions={
          <Link href="/dashboard/developers" className={buttonVariants({ variant: "outline" })}>
            <Icon name="code" /> Integration guide
          </Link>
        }
      />

      {showOnboarding && (
        <OnboardingChecklist
          name={m.name}
          verified={ob.verified}
          skipWorldId={env.skipWorldId()}
          payout={{ address: m.payoutAddress, txHash: m.registeredTxHash, done: ob.payout }}
          apiKey={ob.apiKey}
          webhook={ob.webhook}
        />
      )}

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Gross volume" value={formatAmount(stats.volume)} unit="USDT" hint={`Net ${formatAmount(stats.net)} USDT after refunds`} highlight />
        <StatCard label="Payments" value={String(stats.count)} hint="Verified onchain settlements" />
        <StatCard label="Refunded" value={formatAmount(stats.refunded)} unit="USDT" hint={`${stats.refundedCount} payment${stats.refundedCount === 1 ? "" : "s"} refunded`} />
        <Card className="flex flex-col justify-between gap-3 p-5">
          <p className="text-xs font-medium text-muted-foreground">Payout wallet</p>
          {m.payoutAddress ? (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-sm font-semibold">{shortAddr(m.payoutAddress, 8, 6)}</span>
              <ExplorerLink address={m.payoutAddress} label="View on explorer" />
            </div>
          ) : (
            <Link href="/dashboard/settings" className="inline-flex w-fit items-center gap-1 rounded text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
              Add a payout wallet <Icon name="arrowRight" className="size-3.5" />
            </Link>
          )}
        </Card>
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>Recent payments</CardTitle>
            <CardDescription>The last five settlements to your payout wallet.</CardDescription>
          </div>
          <Link href="/dashboard/payments" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            View all <Icon name="arrowRight" />
          </Link>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <PaymentsTable rows={recent} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add checkout in about 20 lines</CardTitle>
          <CardDescription>Create a session on your server with your secret key, then render the checkout in your store.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <CodeBlock filename="server.ts" code={serverSnippet(env.appUrl())} />
          <CodeBlock filename="Checkout.tsx" code={clientSnippet(env.appUrl())} />
        </CardContent>
      </Card>
    </>
  );
}

function StatCard({ label, value, unit, hint, highlight }: { label: string; value: string; unit?: string; hint?: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "relative overflow-hidden border-transparent bg-ink p-5 text-white" : "p-5"}>
      {highlight && <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-[radial-gradient(closest-side,rgb(59_91_255/0.6),transparent)]" />}
      <div className="relative flex flex-col gap-3">
        <p className={highlight ? "text-xs font-medium text-white/70" : "text-xs font-medium text-muted-foreground"}>{label}</p>
        <p className="text-2xl font-semibold tracking-tight tabular">
          {value} {unit && <span className={highlight ? "text-sm font-medium text-white/60" : "text-sm font-medium text-muted-foreground"}>{unit}</span>}
        </p>
        {hint && <p className={highlight ? "text-xs text-white/60" : "text-xs text-muted-foreground"}>{hint}</p>}
      </div>
    </Card>
  );
}
