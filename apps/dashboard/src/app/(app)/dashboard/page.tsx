import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireMerchant } from "@/lib/auth";
import { env } from "@/lib/env";
import { listPayments, onboardingState, paymentStats } from "./_lib/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { Section } from "@/components/dashboard/section";
import { OnboardingChecklist } from "@/components/dashboard/onboarding";
import { PaymentsTable } from "@/components/dashboard/payments-table";
import { ExplorerLink } from "@/components/dashboard/explorer-link";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { CopyButton } from "@/components/ui/copy-button";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { formatAmount } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

const INSTALL = "npm i @whitechain-commerce/react";

export default async function DashboardHome() {
  const m = await requireMerchant();
  const [stats, recent, ob] = await Promise.all([paymentStats(m.id), listPayments(m.id, 5), onboardingState(m)]);
  const showOnboarding = ob.completed < ob.total;

  return (
    <>
      <AutoRefresh active intervalMs={5000} />
      <PageHeader
        title="Home"
        description={`How ${m.name} is doing on Whitechain Sepolia.`}
        actions={
          // Plain <a>: a route handler download, not a client-side navigation.
          <a href="/dashboard/payments/export" download className={buttonVariants({ variant: "secondary" })}>
            <Icon name="download" /> Export CSV
          </a>
        }
      />

      <section aria-label="Summary" className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Gross volume" value={formatAmount(stats.volume)} unit="USDT" hint={`Net ${formatAmount(stats.net)} USDT after refunds`} />
        <Stat label="Payments" value={String(stats.count)} hint="Verified onchain settlements" />
        <Stat
          label="Refunded"
          value={formatAmount(stats.refunded)}
          unit="USDT"
          hint={`${stats.refundedCount} payment${stats.refundedCount === 1 ? "" : "s"} refunded`}
        />
        <Stat
          label="Payout wallet"
          value={
            m.payoutAddress ? (
              <span className="font-mono text-lg leading-[1.15] tracking-normal sm:text-xl">
                {m.payoutAddress.slice(0, 6)}…{m.payoutAddress.slice(-4)}
              </span>
            ) : (
              <span className="text-muted-foreground">Not set</span>
            )
          }
          hint={
            m.payoutAddress ? (
              <ExplorerLink address={m.payoutAddress} label="View on explorer" />
            ) : (
              <Link href="/dashboard/settings" className="link text-foreground">
                Add a payout wallet
              </Link>
            )
          }
        />
      </section>

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

      <Section
        id="recent"
        title="Recent payments"
        description="The last five settlements to your payout wallet."
        actions={
          <Link href="/dashboard/payments" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            View all <Icon name="arrowRight" />
          </Link>
        }
      >
        <PaymentsTable
          rows={recent}
          compact
          emptyAction={
            <Link href="/dashboard/developers" className={buttonVariants({ size: "sm" })}>
              Set up checkout
            </Link>
          }
        />
      </Section>

      <Section id="integrate" title="Integrate" description="Create a session on your server with a secret key, then render the checkout in your store.">
        <div className="flex flex-col gap-4 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-surface-2 py-1 pr-1 pl-3">
            <span aria-hidden className="font-mono text-[13px] text-faint select-none">
              $
            </span>
            <code className="min-w-0 truncate font-mono text-[13px]">{INSTALL}</code>
            <CopyButton value={INSTALL} label="Copy install command" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/developers" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              <Icon name="key" /> API keys and snippets
            </Link>
            <Link href="/dashboard/webhooks" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Webhooks <Icon name="arrowRight" />
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}

/* docs/DESIGN.md, Stats: label 14px secondary above the value; one bordered strip with dividers. */
function Stat({ label, value, unit, hint }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 bg-background p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="stat-value flex min-w-0 items-baseline gap-1.5 truncate">
        {value}
        {unit && <span className="text-sm font-medium tracking-normal text-muted-foreground">{unit}</span>}
      </p>
      {hint && <div className="min-w-0 truncate text-[13px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
