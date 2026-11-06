import type { Metadata } from "next";
import Link from "next/link";
import { requireMerchant } from "@/lib/auth";
import { listPayments } from "../_lib/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { PaymentsTable } from "@/components/dashboard/payments-table";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/icons";

import { DashboardPager } from "@/components/dashboard/dashboard-pages";
import { pageItems } from "@/lib/dashboard-pages";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const m = await requireMerchant();
  const rows = await listPayments(m.id, 100);
  return (
    <>
      <AutoRefresh active intervalMs={5000} />
      <PageHeader
        title="Payments"
        description="View confirmed USDT payments sent to your payout wallet."
        actions={
          // Plain <a>: a route handler download, not a client-side navigation.
          <a href="/dashboard/payments/export" download className={buttonVariants({ variant: "outline" })}>
            <Icon name="download" /> Export CSV
          </a>
        }
      />
      <DashboardPager
        pages={pageItems(rows, 5).map((page, index) => (
          <Card key={index} className="py-1 [&_td]:py-1.5">
            <PaymentsTable
              rows={page}
              emptyAction={
                <Link href="/dashboard/developers" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Set up checkout
                </Link>
              }
            />
          </Card>
        ))}
      />
      {rows.length === 100 && <p className="text-xs text-muted-foreground">Showing the latest 100 payments.</p>}
    </>
  );
}
