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

export function PaymentsTable({ rows, emptyAction }: { rows: PaymentRowView[]; emptyAction?: React.ReactNode }) {
  if (!rows.length) {
    return (
      <EmptyState
        icon="card"
        title="No payments yet"
        description="Payments appear here as soon as a customer pays through your checkout and the settlement is verified onchain."
        action={emptyAction}
      />
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Order</TableHead>
          <TableHead>Payer</TableHead>
          <TableHead>Transaction</TableHead>
          <TableHead className="text-right">Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p) => (
          <TableRow key={p.id} className="relative">
            <TableCell>
              <Link
                href={`/dashboard/payments/${p.id}`}
                className="font-semibold tabular outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
              >
                {formatAmount(p.amount)} <span className="text-xs font-medium text-muted-foreground">USDT</span>
              </Link>
              {Number(p.refunded) > 0 && (
                <span className="block text-xs text-muted-foreground tabular">−{formatAmount(p.refunded)} refunded</span>
              )}
            </TableCell>
            <TableCell>
              <StatusBadge status={p.status} />
            </TableCell>
            <TableCell className="max-w-48 truncate font-mono text-xs">{p.orderId}</TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">{shortAddr(p.payer)}</TableCell>
            <TableCell className="relative z-[1]">
              <ExplorerLink hash={p.txHash} />
            </TableCell>
            <TableCell className="text-right text-muted-foreground tabular">{formatDateTime(p.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
