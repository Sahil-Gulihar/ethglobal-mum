import type { Metadata } from "next";
import Link from "next/link";
import { requireMerchant } from "@/lib/auth";
import { env } from "@/lib/env";
import { agentClients, integrationPrompts, sdkSnippets } from "@/lib/agent-snippets";
import { describeTool, tools } from "@/lib/mcp/tools";
import { listApiKeys } from "../_lib/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { CreateApiKeyButton } from "@/components/dashboard/create-api-key";
import { DashboardSections } from "@/components/dashboard/dashboard-pages";
import { CodeBlock } from "@/components/code-block";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Agents" };

export default async function AgentsPage() {
  const m = await requireMerchant();
  const keys = await listApiKeys(m.id);
  const activeKeys = keys.filter((k) => !k.revokedAt);
  const base = env.appUrl().replace(/\/$/, "");
  const verified = m.status === "active";
  const described = tools.map(describeTool);

  return (
    <>
      <PageHeader
        title="Agents"
        description="Agents can do what you can do here: take payments with links and checkouts, confirm them onchain, manage webhooks and refunds, and integrate checkout into your code."
        actions={
          <>
            <Link href="/docs/agents" className={buttonVariants({ variant: "outline" })}>
              Documentation
            </Link>
            <CreateApiKeyButton disabled={!verified} />
          </>
        }
      />

      {activeKeys.length === 0 ? (
        <Alert tone="warning">Agents sign in with a secret key. Create one first, then paste it wherever a snippet shows sk_test_...</Alert>
      ) : (
        <Alert>
          Agents act as {m.name} with the key you give them. They can&apos;t move funds: refunds stay pending until you sign them with your payout wallet.
        </Alert>
      )}

      <section className="grid gap-4 sm:grid-cols-3" aria-label="MCP server">
        <InfoCard label="MCP server URL" value={`${base}/api/mcp`} />
        <InfoCard label="Transport" value="Streamable HTTP, Bearer key" copy={false} />
        <InfoCard label="npm package" value="@whitechain-commerce/mcp" />
      </section>

      <DashboardSections
        sections={[
          {
            label: "Connect",
            content: (
              <div className="grid gap-4 lg:grid-cols-2">
                {agentClients(base).map((c) => (
                  <Card key={c.id} className="flex min-w-0 flex-col gap-3 p-4">
                    <div className="flex flex-col gap-1">
                      <h2 className="text-sm font-medium">{c.name}</h2>
                      <p className="text-xs leading-relaxed text-muted-foreground">{c.where}</p>
                    </div>
                    <CodeBlock code={c.code} filename={c.filename} className="mt-auto" />
                  </Card>
                ))}
              </div>
            ),
          },
          {
            label: "Integrate with AI",
            content: (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Paste one of these into a coding agent (Claude Code, Cursor, Codex and others) inside the repo you want to take payments in. The agent reads
                  the{" "}
                  <a href={`${base}/integrate.md`} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4">
                    integration guide
                  </a>
                  , adds the server route, checkout and verified webhooks, and tests a payment. With the MCP server connected it also registers the webhook
                  and confirms the test payment for you, or you can run the <span className="font-mono text-xs text-foreground">integrate_whitechain</span> prompt.
                </p>
                <div className="grid gap-4 lg:grid-cols-2">
                  {integrationPrompts(base).map((p) => (
                    <div key={p.id} className="flex min-w-0 flex-col gap-2">
                      <h2 className="text-sm font-medium">{p.name}</h2>
                      <CodeBlock code={p.code} filename="prompt" className="[&_pre]:whitespace-pre-wrap" />
                    </div>
                  ))}
                </div>
              </div>
            ),
          },
          {
            label: `Tools (${described.length})`,
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Tools your agent gets</CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-2">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Tool</TableHead>
                        <TableHead>What it does</TableHead>
                        <TableHead className="text-right">Access</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {described.map((t) => (
                        <TableRow key={t.name}>
                          <TableCell className="align-top font-mono text-xs whitespace-nowrap">{t.name}</TableCell>
                          <TableCell className="min-w-80 text-sm whitespace-normal! text-muted-foreground">{t.description}</TableCell>
                          <TableCell className="text-right align-top">
                            <Badge>{t.annotations.readOnlyHint ? "Read" : "Write"}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ),
          },
          {
            label: "Build your own agent",
            content: (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Install <span className="font-mono text-xs text-foreground">@whitechain-commerce/mcp</span> in any Node project to give your own agent the same
                  tools. It has no dependencies and formats the tools for each SDK.
                </p>
                <div className="grid gap-4 lg:grid-cols-2">
                  {sdkSnippets(base).map((s) => (
                    <div key={s.id} className="flex min-w-0 flex-col gap-2">
                      <h2 className="text-sm font-medium">{s.name}</h2>
                      <CodeBlock code={s.code} filename={s.filename} />
                    </div>
                  ))}
                </div>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}

function InfoCard({ label, value, copy = true }: { label: string; value: string; copy?: boolean }) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex min-h-8 items-center justify-between gap-2">
        <span className="truncate font-mono text-xs">{value}</span>
        {copy && <CopyButton value={value} label={`Copy ${label}`} />}
      </div>
    </Card>
  );
}
