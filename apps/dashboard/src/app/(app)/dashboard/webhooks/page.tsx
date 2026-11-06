import type { Metadata } from "next";
import { requireMerchant } from "@/lib/auth";
import { listDeliveries, listEndpoints } from "../_lib/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { AddWebhookForm } from "@/components/dashboard/add-webhook-form";
import { WebhookEndpointCard } from "@/components/dashboard/webhook-endpoint-card";
import { DeliveriesLog } from "@/components/dashboard/deliveries-log";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { CodeBlock } from "@/components/code-block";
import { webhookSnippet } from "@/components/snippets";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Webhooks" };

export default async function WebhooksPage() {
  const m = await requireMerchant();
  const [endpoints, deliveries] = await Promise.all([listEndpoints(m.id), listDeliveries(m.id, 50)]);
  const retrying = deliveries.some((d) => d.status === "pending");

  return (
    <>
      <AutoRefresh active={retrying} intervalMs={10_000} />
      <PageHeader title="Webhooks" description="Signed events for every verified payment and refund. Fulfil orders from these, not from the browser." />

      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
          <CardDescription>
            Each request carries a <code className="font-mono">WC-Signature</code> header (HMAC-SHA256 of <code className="font-mono">t.body</code>). Failed deliveries retry after 1 min, 5 min and 30 min.
          </CardDescription>
        </CardHeader>
        {endpoints.length > 0 && (
          <div className="divide-y border-y">
            {endpoints.map((e) => (
              <WebhookEndpointCard key={e.id} id={e.id} url={e.url} enabled={e.enabled} createdAt={e.createdAt.toISOString()} secretHint={e.secretHint} />
            ))}
          </div>
        )}
        <CardContent className="pt-5">
          <AddWebhookForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent deliveries</CardTitle>
          <CardDescription>The last 50 deliveries across all endpoints. Expand a row to see each attempt.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <DeliveriesLog
            rows={deliveries.map((d) => ({
              ...d,
              nextAttemptAt: d.nextAttemptAt.toISOString(),
              createdAt: d.createdAt.toISOString(),
              attemptLog: d.attemptLog.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verify signatures</CardTitle>
          <CardDescription>Use the endpoint&apos;s signing secret. Deduplicate on the event id: deliveries are at-least-once.</CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock filename="app/api/webhooks/whitechain/route.ts" code={webhookSnippet()} />
        </CardContent>
      </Card>
    </>
  );
}
