import type { Metadata } from "next";
import Link from "next/link";
import { requireMerchant } from "@/lib/auth";
import { listPayments } from "../_lib/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { PaymentsTable } from "@/components/dashboard/payments-table";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const m = await requireMerchant();
  const rows = await listPayments(m.id, 100);
  return (
    <>
      <AutoRefresh active intervalMs={5000} />
      <PageHeader title="Payments" description="Every USDT payment settled to your payout wallet, verified against the PaymentSettled event." />
      <Card className="py-1">
        <PaymentsTable
          rows={rows}
          emptyAction={
            <Link href="/dashboard/developers" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Set up checkout
            </Link>
          }
        />
      </Card>
      {rows.length === 100 && <p className="text-xs text-muted-foreground">Showing the latest 100 payments.</p>}
    </>
  );
}
