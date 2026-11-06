import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { PayoutWalletForm } from "@/components/dashboard/payout-wallet-form";
import { CreateApiKeyButton } from "@/components/dashboard/create-api-key";
import { AddWebhookForm } from "@/components/dashboard/add-webhook-form";
import { WorldIdVerifyButton } from "@/components/dashboard/world-id-verify";
import { DashboardPager } from "./dashboard-pages";
import { cn } from "@/lib/utils";

export type OnboardingProps = {
  name: string;
  verified: boolean;
  skipWorldId: boolean;
  /** True once a World ID nullifier is stored for this merchant. */
  worldVerified: boolean;
  payout: { address: string | null; txHash: string | null; done: boolean };
  apiKey: boolean;
  webhook: boolean;
};

type Step = { key: string; title: string; description: string; done: boolean; skipped?: boolean; body?: ReactNode };

export function OnboardingChecklist(p: OnboardingProps) {
  const steps: Step[] = [
    {
      key: "business",
      title: "Add your business",
      description: `Customers see “${p.name}” at checkout.`,
      done: true,
      body: (
        <Link href="/dashboard/settings" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Edit business name
        </Link>
      ),
    },
    {
      key: "verify",
      title: "Verify you’re human",
      description: "One person, one merchant account. Prove you're a unique human with World ID.",
      done: p.verified,
      skipped: p.verified && !p.worldVerified,
      body: p.verified ? (
        <div className="flex items-center gap-3 rounded-sm border-[0.5px] border-dashed px-3 py-2.5 text-sm text-muted-foreground">
          <Icon name="shield" className="text-primary" />
          {p.worldVerified ? "Verified with World ID. Your account is active." : "Verification is skipped. Your account is active."}
        </div>
      ) : (
        <WorldIdVerifyButton />
      ),
    },
    {
      key: "payout",
      title: "Connect your payout wallet",
      description: "Payments settle directly to this wallet. We never hold your funds.",
      done: p.payout.done,
      body: p.verified ? (
        <PayoutWalletForm currentPayout={p.payout.address} currentTxHash={p.payout.txHash} />
      ) : (
        <p className="text-sm text-muted-foreground">Unlocks once your account is verified.</p>
      ),
    },
    {
      key: "apikey",
      title: "Create an API key",
      description: "Your server uses it to create checkout sessions.",
      done: p.apiKey,
      body: <CreateApiKeyButton disabled={!p.verified} />,
    },
    {
      key: "webhook",
      title: "Add a webhook endpoint",
      description: "Fulfil orders from signed events, never from the browser callback.",
      done: p.webhook,
      body: <AddWebhookForm />,
    },
  ];
  const completed = steps.filter((s) => s.done).length;
  const current = steps.findIndex((s) => !s.done);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b bg-muted px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold tracking-tight">Get set up to accept USDT</h2>
          <p className="text-sm text-muted-foreground">Finish these steps to take your first payment on Whitechain.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium tabular">
            {completed} of {steps.length}
          </span>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={completed} aria-label="Setup progress">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(completed / steps.length) * 100}%` }} />
          </div>
        </div>
      </div>
      <div className="p-3">
        <DashboardPager label="Step" initial={Math.max(current, 0)} pages={steps.map((s, i) => {
          const isCurrent = i === current;
          return (
            <div key={s.key} className={cn("flex gap-3 px-5 py-2.5", isCurrent && "bg-muted")}>
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 grid size-6 shrink-0 place-items-center rounded-sm border-[0.5px] text-xs font-semibold",
                  s.done ? "border-transparent bg-primary text-primary-foreground" : isCurrent ? "border-primary text-primary" : "text-muted-foreground",
                )}
              >
                {s.done ? <Icon name="check" className="size-3.5" /> : i + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn("text-sm font-semibold", s.done && !isCurrent && "text-muted-foreground")}>{s.title}</p>
                    {s.skipped && <Badge>Verification skipped</Badge>}
                    <span className="sr-only">{s.done ? "(done)" : isCurrent ? "(current step)" : "(to do)"}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{s.description}</p>
                </div>
                {isCurrent && s.body}
              </div>
            </div>
          );
        })} />
      </div>
    </Card>
  );
}
