import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireMerchant } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { BusinessNameForm } from "@/components/dashboard/business-name-form";
import { PayoutWalletForm } from "@/components/dashboard/payout-wallet-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { CopyButton } from "@/components/ui/copy-button";
import { formatDate, shortHash } from "@/lib/utils";

import { DashboardSections } from "@/components/dashboard/dashboard-pages";
import { CodeBlock } from "@/components/code-block";
import { humanCheckStats } from "../_lib/queries";

export const metadata: Metadata = { title: "Settings" };

const VERIFIED_BUYER_SNIPPET = `const session = await createCheckoutSession({
  secretKey: process.env.WC_SECRET_KEY!,
  orderId: order.id,
  amount: "4.99",
  requireVerifiedBuyer: true, // buyer verifies with World ID before paying
});`;

export default async function SettingsPage() {
  const m = await requireMerchant();
  const active = m.status === "active";
  const checks = await humanCheckStats(m.id);
  return (
    <>
      <PageHeader title="Settings" description="Your business profile and where payments settle." />

      <DashboardSections
        sections={[
          {
            label: "Business",
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Business</CardTitle>
                </CardHeader>
                <CardContent>
                  <BusinessNameForm name={m.name} />
                </CardContent>
              </Card>
            ),
          },
          {
            label: "Payout wallet",
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Payout wallet</CardTitle>
                  <CardDescription>
                    Payments settle straight to this wallet, and refunds are signed from it. Changing it re-registers your merchant onchain; refunds
                    for older payments must then be sent from the new wallet.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {active ? (
                    <PayoutWalletForm
                      currentPayout={m.payoutAddress}
                      currentTxHash={m.registeredTxHash}
                      submitLabel={m.payoutAddress ? "Change payout wallet" : "Use as payout wallet"}
                    />
                  ) : (
                    <Alert tone="warning">Verify your account to add a payout wallet.</Alert>
                  )}
                </CardContent>
              </Card>
            ),
          },
          {
            label: "Verified buyers",
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Verified buyers</CardTitle>
                  <CardDescription>
                    Stop bots from buying at your checkout. Turn it on in code: pass <code>requireVerifiedBuyer: true</code> when you create a checkout
                    session, and the buyer proves they&apos;re human with World ID before the pay button appears. Payments show a Verified buyer badge,
                    and webhooks carry <code>buyerVerified</code>.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <CodeBlock code={VERIFIED_BUYER_SNIPPET} language="ts" filename="app/api/orders/route.ts" />
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <Stat label="Verified with World ID" value={checks.worldId} />
                    <Stat label="Checks run on 0G" value={checks.total} />
                    <Stat label="0G checks passed" value={checks.passed} />
                    <Stat label="Paid by buyers' 0G credits" value={checks.buyerPaid} />
                  </dl>
                </CardContent>
              </Card>
            ),
          },
          {
            label: "Account",
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Account</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="flex flex-col divide-y text-sm">
                    <Row label="Email">{m.email}</Row>
                    <Row label="Status">
                      <Badge tone={active ? "success" : "warning"} dot>
                        {active ? "Active" : "Pending verification"}
                      </Badge>
                      {m.worldNullifier ? <Badge tone="success">Verified with World ID</Badge> : active && <Badge>World ID skipped</Badge>}
                    </Row>
                    <Row label="Merchant ID" copy={m.id}>
                      <span className="font-mono text-xs">{m.id}</span>
                    </Row>
                    <Row label="Onchain merchant ID" copy={m.chainMerchantId}>
                      <span className="font-mono text-xs">{shortHash(m.chainMerchantId)}</span>
                    </Row>
                    <Row label="Chain ID">1874</Row>
                    <Row label="Member since">{formatDate(m.createdAt)}</Row>
                  </dl>
                </CardContent>
              </Card>
            ),
          },
        ]}
      />
    </>
  );
}

function Row({ label, children, copy }: { label: string; children: ReactNode; copy?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        {children}
        {copy && <CopyButton value={copy} label={`Copy ${label}`} className="-my-1 h-7 min-w-7" />}
      </dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular">{value}</dd>
    </div>
  );
}
