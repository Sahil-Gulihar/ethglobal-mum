import { Badge, type BadgeTone } from "@/components/ui/badge";

/* Status label: dot in the semantic color plus text (docs/DESIGN.md, Status). Refunds are a neutral state, not an error. */
const payment: Record<string, { tone: BadgeTone; label: string }> = {
  succeeded: { tone: "success", label: "Succeeded" },
  partially_refunded: { tone: "neutral", label: "Partially refunded" },
  refunded: { tone: "neutral", label: "Refunded" },
  pending: { tone: "warning", label: "Pending" },
  failed: { tone: "danger", label: "Failed" },
  open: { tone: "neutral", label: "Open" },
  processing: { tone: "warning", label: "Processing" },
  paid: { tone: "success", label: "Paid" },
  expired: { tone: "neutral", label: "Expired" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = payment[status] ?? { tone: "neutral" as const, label: status };
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}
