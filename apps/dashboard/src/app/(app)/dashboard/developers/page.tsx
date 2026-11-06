import type { Metadata } from "next";
import Link from "next/link";
import { getRouterAddress, USDT_ADDRESS } from "@whitechain-commerce/core";
import { requireMerchant } from "@/lib/auth";
import { env } from "@/lib/env";
import { listApiKeys } from "../_lib/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { CreateApiKeyButton } from "@/components/dashboard/create-api-key";
import { RevokeKeyButton } from "@/components/dashboard/revoke-key-button";
import { ExplorerLink } from "@/components/dashboard/explorer-link";
import { CodeBlock } from "@/components/code-block";
import { clientSnippet, serverSnippet, webhookSnippet } from "@/components/snippets";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, relativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Developers" };

export default async function DevelopersPage() {
  const m = await requireMerchant();
  const keys = await listApiKeys(m.id);
  const active = keys.filter((k) => !k.revokedAt);
  const apiBase = env.appUrl().replace(/\/$/, "");
  const verified = m.status === "active";

  return (
    <>
      <PageHeader
        title="Developers"
        description="Secret keys and everything you need to add Whitechain checkout to your store."
        actions={<CreateApiKeyButton disabled={!verified} />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Secret keys</CardTitle>
          <CardDescription>Server-side only. Send as <code className="font-mono">Authorization: Bearer sk_test_…</code></CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {keys.length === 0 ? (
            <EmptyState icon="key" title="No secret keys yet" description="Create a key to start creating checkout sessions from your server." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id} className={k.revokedAt ? "opacity-60" : undefined}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{k.prefix}••••••••</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular">{formatDate(k.createdAt)}</TableCell>
                    <TableCell className="text-muted-foreground">{k.lastUsedAt ? relativeTime(k.lastUsedAt) : "Never"}</TableCell>
                    <TableCell className="text-right">
                      {k.revokedAt ? <Badge>Revoked {formatDate(k.revokedAt)}</Badge> : <RevokeKeyButton id={k.id} prefix={k.prefix} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Network">
        <InfoCard label="API base URL" value={`${apiBase}/api/v1`} />
        <InfoCard label="PaymentRouter" value={getRouterAddress()} link />
        <InfoCard label="USDT (6 decimals)" value={USDT_ADDRESS} link />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Integrate in three steps</CardTitle>
          <CardDescription>
            {active.length ? "Your keys are ready. " : "Create a secret key first. "}
            Install <code className="font-mono">@whitechain-commerce/react</code>, create a session on your server, render the checkout, and fulfil from the webhook.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Step n={1} title="Create a checkout session on your server">
            <CodeBlock filename="app/api/checkout/route.ts" code={serverSnippet(apiBase)} />
          </Step>
          <Step n={2} title="Render the checkout widget">
            <CodeBlock filename="Checkout.tsx" code={clientSnippet(apiBase)} />
          </Step>
          <Step n={3} title="Fulfil orders from verified webhooks">
            <CodeBlock filename="app/api/webhooks/whitechain/route.ts" code={webhookSnippet()} />
            <Link href="/dashboard/webhooks" className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}>
              Manage webhook endpoints
            </Link>
          </Step>
        </CardContent>
      </Card>
    </>
  );
}

function InfoCard({ label, value, link }: { label: string; value: string; link?: boolean }) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center justify-between gap-2">
        {link ? <ExplorerLink address={value} /> : <span className="truncate font-mono text-xs">{value}</span>}
        <CopyButton value={value} label={`Copy ${label}`} />
      </div>
    </Card>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="text-sm font-semibold">{title}</p>
        {children}
      </div>
    </div>
  );
}
