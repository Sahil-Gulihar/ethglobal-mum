import type { Metadata } from "next";
import { getRouterAddress, USDT_ADDRESS } from "@whitechain-commerce/core";
import { requireMerchant } from "@/lib/auth";
import { env } from "@/lib/env";
import { listApiKeys } from "../_lib/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { CreateApiKeyButton } from "@/components/dashboard/create-api-key";
import { RevokeKeyButton } from "@/components/dashboard/revoke-key-button";
import { ExplorerLink } from "@/components/dashboard/explorer-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, relativeTime } from "@/lib/utils";
import { agentSetupPrompt } from "@/lib/agent-snippets";
import { CodeBlock } from "@/components/code-block";
import Link from "next/link";

import { DashboardPager, DashboardSections } from "@/components/dashboard/dashboard-pages";
import { pageItems } from "@/lib/dashboard-pages";

export const metadata: Metadata = { title: "Developers" };

export default async function DevelopersPage() {
  const m = await requireMerchant();
  const keys = await listApiKeys(m.id);
  const apiBase = env.appUrl().replace(/\/$/, "");
  const verified = m.status === "active";
  const prompt = agentSetupPrompt(apiBase);

  return (
    <>
      <PageHeader
        title="Developers"
        actions={
          <>
            <a
              href="https://github.com/Sahil-Gulihar/ethglobal-mum/tree/main/docs/developers"
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              Documentation
            </a>
            <CreateApiKeyButton disabled={!verified} />
          </>
        }
      />

      <Card className="flex min-w-0 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-sm font-medium">Set up payments with an AI agent</h2>
            <p className="text-sm text-muted-foreground">
              Paste this into Claude Code, Cursor, Codex or any coding agent, inside the repo that should take payments. It adds checkout, verified
              webhooks and order status, then tells you what&apos;s left to do.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/dashboard/agents" className={buttonVariants({ variant: "outline", size: "sm" })}>
              More prompts
            </Link>
            <CopyButton value={prompt} label="Copy prompt" showLabel className="h-8 border border-border px-2.5 text-foreground" />
          </div>
        </div>
        <CodeBlock code={prompt} filename="prompt for agents" className="[&_pre]:max-h-64 [&_pre]:whitespace-pre-wrap" />
      </Card>

      <DashboardSections
        sections={[
          {
            label: "Secret keys",
            content: (
              <DashboardPager
                pages={pageItems(keys, 4).map((page, index) => (
                  <Card key={index} className="[&_td]:py-1.5">
                    <CardHeader>
                      <CardTitle>Secret keys</CardTitle>
                    </CardHeader>
                    <CardContent className="px-0 pb-2">
                      {page.length === 0 ? (
                        <EmptyState icon="key" title="No secret keys yet" />
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
                            {page.map((k) => (
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
                ))}
              />
            ),
          },
          {
            label: "Network",
            content: (
              <section className="grid gap-4 sm:grid-cols-3" aria-label="Network">
                <InfoCard label="API base URL" value={`${apiBase}/api/v1`} />
                <InfoCard label="PaymentRouter" value={getRouterAddress()} link />
                <InfoCard label="USDT (6 decimals)" value={USDT_ADDRESS} link />
              </section>
            ),
          },
        ]}
      />
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
