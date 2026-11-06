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
      title: "Verify your account",
      description: "Use World ID to verify your account.",
      done: p.verified,
      skipped: p.verified && !p.worldVerified,
      body: p.verified ? (
        <div className="flex items-center gap-3 rounded-sm border-[0.5px] border-dashed px-3 py-2.5 text-sm text-muted-foreground">
          <Icon name="shield" className="text-primary" />
          {p.worldVerified ? "Your account is verified and ready to use." : "Your account is ready to use."}
        </div>
      ) : (
        <WorldIdVerifyButton />
      ),
    },
    {
      key: "payout",
      title: "Connect your payout wallet",
      description: "Customer payments go straight to this wallet.",
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
      body: p.verified ? (
        <CreateApiKeyButton />
      ) : (
        <p className="text-sm text-muted-foreground">Unlocks once your account is verified.</p>
      ),
    },
    {
      key: "webhook",
      title: "Set up payment updates",
      description: "Add a webhook so your server knows when it’s safe to fulfil an order. Check the signature before updating the order.",
      done: p.webhook,
      body: <AddWebhookForm />,
    },
  ];
  const completed = steps.filter((s) => s.done).length;
  const isComplete = completed === steps.length;
  const current = steps.findIndex((s) => !s.done);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b bg-muted px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1" aria-live="polite">
          <h2 className="text-base font-semibold tracking-tight">
            {isComplete ? "Setup complete" : "Get set up to accept USDT"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isComplete
              ? "Your payout wallet, API key, and payment updates are configured."
              : "Finish these steps to take your first payment on Whitechain."}
          </p>
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
      <ol className="divide-y p-3">
        {steps.map((s, i) => {
          const isCurrent = i === current;
          return (
            <li key={s.key} aria-current={isCurrent ? "step" : undefined} className={cn("flex gap-3 px-5 py-2.5", isCurrent && "bg-muted")}>
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
                    <p className={cn("text-sm font-semibold", s.done && "text-muted-foreground")}>{s.title}</p>
                    {s.skipped && <Badge>Account active</Badge>}
                    <span className="sr-only">{s.done ? "(done)" : isCurrent ? "(current step)" : "(to do)"}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{s.description}</p>
                </div>
                {(!s.done || s.key === "business") && s.body}
              </div>
            </li>
          );
        })}
      </ol>
      {isComplete && (
        <div className="flex justify-end border-t px-5 py-3">
          <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
            Back to dashboard <Icon name="arrowRight" />
          </Link>
        </div>
      )}
    </Card>
  );
}
