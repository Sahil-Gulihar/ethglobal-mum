import type { Metadata } from "next";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { OnboardingChecklist } from "@/components/dashboard/onboarding";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireMerchant } from "@/lib/auth";
import { env } from "@/lib/env";
import { onboardingState } from "../_lib/queries";

export const metadata: Metadata = { title: "Setup" };

export default async function SetupPage() {
  const merchant = await requireMerchant();
  const setup = await onboardingState(merchant);

  return (
    <>
      <AutoRefresh active />
      <PageHeader title="Setup" />
      <OnboardingChecklist
        name={merchant.name}
        verified={setup.verified}
        skipWorldId={env.skipWorldId()}
        worldVerified={!!merchant.worldNullifier}
        payout={{ address: merchant.payoutAddress, txHash: merchant.registeredTxHash, done: setup.payout }}
        apiKey={setup.apiKey}
        webhook={setup.webhook}
      />
    </>
  );
}
