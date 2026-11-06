import type { Metadata } from "next";
import { requireMerchant } from "@/lib/auth";
import { listDeliveries, listEndpoints } from "../_lib/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { AddWebhookForm } from "@/components/dashboard/add-webhook-form";
import { WebhookEndpointCard } from "@/components/dashboard/webhook-endpoint-card";
import { DeliveriesLog } from "@/components/dashboard/deliveries-log";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { DashboardPager, DashboardSections } from "@/components/dashboard/dashboard-pages";
import { pageItems } from "@/lib/dashboard-pages";

export const metadata: Metadata = { title: "Webhooks" };

export default async function WebhooksPage() {
  const m = await requireMerchant();
  const [endpoints, deliveries] = await Promise.all([listEndpoints(m.id), listDeliveries(m.id, 50)]);
  const retrying = deliveries.some((d) => d.status === "pending");

  return (
    <>
      <AutoRefresh active={retrying} intervalMs={10_000} />
      <PageHeader
        title="Webhooks"
        actions={
          <a
            href="https://github.com/Sahil-Gulihar/ethglobal-mum/blob/main/docs/developers/webhooks.md"
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            Documentation
          </a>
        }
      />

      <DashboardSections
        sections={[
          {
            label: "Endpoints",
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Endpoints</CardTitle>
                </CardHeader>
                {endpoints.length > 0 ? (
                  <CardContent className="px-0 pb-3">
                    <DashboardPager
                      label="Endpoint"
                      pages={endpoints.map((e) => (
                        <div key={e.id} className="border-y">
                          <WebhookEndpointCard
                            id={e.id}
                            url={e.url}
                            enabled={e.enabled}
                            createdAt={e.createdAt.toISOString()}
                            secretHint={e.secretHint}
                          />
                        </div>
                      ))}
                    />
                  </CardContent>
                ) : (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">No endpoints yet.</p>
                  </CardContent>
                )}
              </Card>
            ),
          },
          {
            label: "Add endpoint",
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Add an endpoint</CardTitle>
                </CardHeader>
                <CardContent>
                  <AddWebhookForm />
                </CardContent>
              </Card>
            ),
          },
          {
            label: "Deliveries",
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Recent deliveries</CardTitle>
                  <CardDescription>Latest 50 deliveries</CardDescription>
                </CardHeader>
                <CardContent className="px-0 pb-2">
                  <DashboardPager
                    pages={pageItems(deliveries, 4).map((page, index) => (
                      <DeliveriesLog
                        key={index}
                        rows={page.map((d) => ({
                          ...d,
                          nextAttemptAt: d.nextAttemptAt.toISOString(),
                          createdAt: d.createdAt.toISOString(),
                          attemptLog: d.attemptLog.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
                        }))}
                      />
                    ))}
                  />
                </CardContent>
              </Card>
            ),
          },
        ]}
      />
    </>
  );
}
