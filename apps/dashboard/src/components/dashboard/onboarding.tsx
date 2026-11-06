import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { PayoutWalletForm } from "@/components/dashboard/payout-wallet-form";
import { CreateApiKeyButton } from "@/components/dashboard/create-api-key";
import { AddWebhookForm } from "@/components/dashboard/add-webhook-form";
import { cn } from "@/lib/utils";

export type OnboardingProps = {
  name: string;
  verified: boolean;
  skipWorldId: boolean;
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
        <Link href="/dashboard/settings" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Edit business name
        </Link>
      ),
    },
    {
      key: "verify",
      title: "Verify you’re human",
      description: "One person, one merchant account. World ID Proof of Human verification is coming soon.",
      done: p.verified,
      skipped: p.verified && p.skipWorldId,
      body: (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon name="shield" />
          {p.skipWorldId ? "Skipped on testnet. Your account is active." : "World ID verification is coming soon."}
        </div>
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
    <section aria-labelledby="setup-title" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex flex-col gap-0.5">
          <h2 id="setup-title" className="text-base leading-6 font-medium tracking-[-0.02em]">
            Get set up to accept USDT
          </h2>
          <p className="text-sm text-muted-foreground">Finish these steps to take your first payment on Whitechain.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-muted-foreground tabular">
            {completed} of {steps.length} done
          </span>
          <div className="h-1 w-24 overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={completed} aria-label="Setup progress">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(completed / steps.length) * 100}%` }} />
          </div>
        </div>
      </div>
      <ol className="divide-y divide-border rounded-lg border border-border">
        {steps.map((s, i) => {
          const isCurrent = i === current;
          return (
            <li key={s.key} className="flex gap-3.5 px-4 py-4 sm:px-5">
              <span
                aria-hidden
                className={cn(
                  "mt-px grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-medium tabular",
                  s.done ? "bg-primary text-primary-foreground" : isCurrent ? "border border-border-strong text-foreground" : "border border-border-default text-faint",
                )}
              >
                {s.done ? <Icon name="check" className="size-3" /> : i + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className={cn("text-sm font-medium", s.done ? "text-muted-foreground" : "text-foreground")}>{s.title}</p>
                    {s.skipped && <Badge>Skipped on testnet</Badge>}
                    <span className="sr-only">{s.done ? "(done)" : isCurrent ? "(current step)" : "(to do)"}</span>
                  </div>
                  {(isCurrent || !s.done) && <p className="text-sm text-muted-foreground">{s.description}</p>}
                </div>
                {isCurrent && <div className="max-w-xl">{s.body}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
