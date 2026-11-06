"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { redeliverWebhook } from "@/lib/actions/webhooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DashboardPager } from "./dashboard-pages";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/icons";
import { cn, formatDateTime, relativeTime } from "@/lib/utils";

export type DeliveryRow = {
  id: string;
  eventId: string;
  eventType: string;
  isTest?: boolean;
  endpointUrl: string;
  status: "pending" | "succeeded" | "failed";
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  nextAttemptAt: string;
  createdAt: string;
  attemptLog: {
    id: string;
    attempt: number;
    statusCode: number | null;
    error: string | null;
    responseBody: string | null;
    durationMs: number | null;
    createdAt: string;
  }[];
};

const tone: Record<DeliveryRow["status"], BadgeTone> = { pending: "warning", succeeded: "success", failed: "danger" };
const label: Record<DeliveryRow["status"], string> = { pending: "Retrying", succeeded: "Delivered", failed: "Failed" };

export function DeliveriesLog({ rows }: { rows: DeliveryRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const [, startTransition] = useTransition();

  if (!rows.length) {
    return (
      <EmptyState
        icon="webhook"
        title="No deliveries yet"
        description="Events appear here when a payment or refund settles, or when you send a test event."
      />
    );
  }

  const delivery = rows.find((row) => row.id === open);

  return (
    <>
      <Table className="[&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-8">
              <span className="sr-only">Delivery attempts</span>
            </TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Attempts</TableHead>
            <TableHead>Last response</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="pr-0">
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-label="Show attempts"
                  onClick={() => setOpen(d.id)}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon name="chevronDown" className="size-4" />
                </button>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-medium">{d.eventType}</span>
                    {d.isTest && <Badge>Test</Badge>}
                  </span>
                  <span className="max-w-64 truncate text-xs text-muted-foreground" title={d.endpointUrl}>
                    {d.endpointUrl}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Badge tone={tone[d.status]} dot>
                  {label[d.status]}
                </Badge>
              </TableCell>
              <TableCell className="tabular">{d.attempts}</TableCell>
              <TableCell className="font-mono text-xs">
                {d.lastStatusCode ?? (d.lastError ? <span className="text-destructive">error</span> : "—")}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy === d.id}
                  onClick={() => {
                    setBusy(d.id);
                    setMsg(null);
                    startTransition(async () => {
                      const r = await redeliverWebhook(d.id);
                      setBusy(null);
                      setMsg(
                        r.ok
                          ? {
                              id: d.id,
                              ok: r.value.ok,
                              text: r.value.ok
                                ? `Delivered (HTTP ${r.value.statusCode})`
                                : `Failed${r.value.statusCode ? ` (HTTP ${r.value.statusCode})` : ""}${r.value.error ? `: ${r.value.error}` : ""}`,
                            }
                          : { id: d.id, ok: false, text: r.error },
                      );
                      router.refresh();
                    });
                  }}
                >
                  {busy === d.id ? <Spinner /> : <Icon name="refresh" />} Redeliver
                </Button>
                {msg?.id === d.id && (
                  <span role="status" className={cn("block text-xs", msg.ok ? "text-success" : "text-destructive")}>
                    {msg.text}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={!!delivery} onOpenChange={() => setOpen(null)} title="Delivery attempts">
        {delivery && (
          <>
            <p className="wrap-anywhere font-mono text-xs text-muted-foreground">
              {delivery.eventId} · {delivery.id}
            </p>
            <p className="text-xs text-muted-foreground">
              Created {formatDateTime(delivery.createdAt)}
              {delivery.status === "pending" && ` · Next retry ${relativeTime(delivery.nextAttemptAt)}`}
            </p>
            {delivery.attemptLog.length ? (
              <DashboardPager
                label="Attempt"
                pages={delivery.attemptLog.map((attempt) => (
                  <div key={attempt.id} className="flex flex-col gap-2 rounded-sm border p-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">Attempt {attempt.attempt}</span>
                      <Badge tone={attempt.statusCode !== null && attempt.statusCode >= 200 && attempt.statusCode < 300 ? "success" : "danger"}>
                        {attempt.statusCode ?? "No response"}
                      </Badge>
                      <span className="text-muted-foreground">{formatDateTime(attempt.createdAt)}</span>
                      {attempt.durationMs !== null && <span>{attempt.durationMs} ms</span>}
                    </div>
                    {attempt.error && <p className="wrap-anywhere text-destructive">{attempt.error}</p>}
                    {attempt.responseBody && (
                      <div>
                        <pre className="max-h-24 overflow-auto rounded-sm bg-muted p-2 font-mono whitespace-pre-wrap wrap-anywhere">
                          {attempt.responseBody}
                        </pre>
                        <CopyButton value={attempt.responseBody} label="Copy response" showLabel />
                      </div>
                    )}
                  </div>
                ))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No attempts yet.</p>
            )}
          </>
        )}
      </Dialog>
    </>
  );
}
