import type { Metadata } from "next";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { PageHeader } from "@/components/dashboard/page-header";
import { SettlementChart } from "@/components/dashboard/settlement-chart";
import { requireMerchant } from "@/lib/auth";
import { dailyPayments } from "../_lib/queries";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const merchant = await requireMerchant();
  const daily = await dailyPayments(merchant.id);

  return (
    <>
      <AutoRefresh active />
      <PageHeader title="Analytics" description="Track your store’s confirmed onchain settlements by day." />
      <SettlementChart daily={daily} />
    </>
  );
}
