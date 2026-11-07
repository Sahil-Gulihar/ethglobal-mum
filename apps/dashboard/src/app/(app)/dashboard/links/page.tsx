import type { Metadata } from "next";
import { requireMerchant } from "@/lib/auth";
import { env } from "@/lib/env";
import { listPaymentLinks } from "@/lib/payment-links";
import { PageHeader } from "@/components/dashboard/page-header";
import { CreatePaymentLinkButton, TogglePaymentLinkButton } from "@/components/dashboard/payment-link-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { LocalTime } from "@/components/ui/local-time";

export const metadata: Metadata = { title: "Payment links" };

export default async function PaymentLinksPage() {
  const m = await requireMerchant();
  const links = await listPaymentLinks(m.id);
  const appUrl = env.appUrl().replace(/\/$/, "");
  const ready = m.status === "active" && !!m.payoutAddress && !!m.registeredTxHash;

  return (
    <>
      <PageHeader
        title="Payment links"
        description="Take a fixed USDT payment with a link you can share anywhere."
        actions={<CreatePaymentLinkButton disabled={!ready} appUrl={appUrl} />}
      />
      <Card className="[&_td]:py-1.5">
        <CardHeader>
          <CardTitle>Links</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {links.length === 0 ? (
            <EmptyState
              icon="link"
              title="No payment links yet"
              description={ready ? "Create one and share it in a chat, bio or invoice." : "Verify your account and set a payout wallet to create links."}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead className="text-right">Payments</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((l) => {
                  const url = `${appUrl}/pay/${l.id}`;
                  return (
                    <TableRow key={l.id} className={l.active ? undefined : "opacity-60"}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          {l.name}
                          {!l.active && <Badge>Off</Badge>}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular">{l.amount} USDT</TableCell>
                      <TableCell>
                        <span className="inline-flex max-w-[22rem] items-center gap-1">
                          <a href={url} target="_blank" rel="noreferrer" className="truncate font-mono text-xs hover:underline">
                            {url.replace(/^https?:\/\//, "")}
                          </a>
                          <CopyButton value={url} label={`Copy link for ${l.name}`} />
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular text-muted-foreground">
                        {l.paidCount} · {l.paidTotal} USDT
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular"><LocalTime value={l.createdAt} mode="date" /></TableCell>
                      <TableCell className="text-right">
                        <TogglePaymentLinkButton id={l.id} active={l.active} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
