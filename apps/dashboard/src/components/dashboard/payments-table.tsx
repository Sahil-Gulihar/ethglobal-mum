import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ExplorerLink } from "@/components/dashboard/explorer-link";
import { formatAmount, formatDateTime, shortAddr } from "@/lib/utils";

export type PaymentRowView = {
  id: string;
  orderId: string;
  amount: string;
  refunded: string;
  status: string;
  payer: string;
  txHash: string;
  createdAt: Date;
};

/** Payments table. The order id links to the detail page and its hit area covers the whole row. */
export function PaymentsTable({ rows, emptyAction, compact = false }: { rows: PaymentRowView[]; emptyAction?: React.ReactNode; compact?: boolean }) {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-border">
        <EmptyState title="No payments yet" description="Payments appear here once a customer pays through your checkout and the settlement is verified onchain." action={emptyAction} />
      </div>
    );
  }
  return (
    <Table framed>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="max-md:hidden">Customer</TableHead>
          {!compact && <TableHead className="max-lg:hidden">Transaction</TableHead>}
          <TableHead className="max-sm:hidden">Date</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p) => (
          <TableRow key={p.id} className="relative">
            <TableCell className="max-w-56">
              <Link
                href={`/dashboard/payments/${p.id}`}
                className="block truncate font-mono text-[13px] text-foreground after:absolute after:inset-0 after:content-[''] hover:underline hover:underline-offset-[3px]"
                title={p.orderId}
              >
                {p.orderId}
              </Link>
            </TableCell>
            <TableCell>
              <StatusBadge status={p.status} />
            </TableCell>
            <TableCell className="font-mono text-[13px] text-muted-foreground max-md:hidden">{shortAddr(p.payer)}</TableCell>
            {!compact && (
              <TableCell className="relative z-[1] max-lg:hidden">
                <ExplorerLink hash={p.txHash} />
              </TableCell>
            )}
            <TableCell className="font-mono text-[13px] text-muted-foreground max-sm:hidden">{formatDateTime(p.createdAt)}</TableCell>
            <TableCell className="text-right">
              <span className="font-medium">{formatAmount(p.amount)}</span> <span className="text-[13px] text-muted-foreground">USDT</span>
              {Number(p.refunded) > 0 && <span className="block text-[13px] text-muted-foreground">−{formatAmount(p.refunded)} refunded</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
