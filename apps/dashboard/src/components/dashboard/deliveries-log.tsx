"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { redeliverWebhook } from "@/lib/actions/webhooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/icons";
import { cn, relativeTime } from "@/lib/utils";
import { LocalTime } from "@/components/ui/local-time";

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
  attemptLog: { id: string; attempt: number; statusCode: number | null; error: string | null; responseBody: string | null; durationMs: number | null; createdAt: string }[];
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
    return <EmptyState icon="webhook" title="No deliveries yet" description="Events appear here when a payment or refund settles, or when you send a test event." />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-8">
            <span className="sr-only">Expand</span>
          </TableHead>
          <TableHead>Event</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Attempts</TableHead>
          <TableHead>Last response</TableHead>
          <TableHead>Next retry</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((d) => {
          const expanded = open === d.id;
          return (
            <Fragment key={d.id}>
              <TableRow>
                <TableCell className="pr-0">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-label={expanded ? "Hide attempts" : "Show attempts"}
                    onClick={() => setOpen(expanded ? null : d.id)}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon name="chevronDown" className={cn("size-4 transition-transform", expanded && "rotate-180")} />
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
                <TableCell className="text-muted-foreground">{d.status === "pending" ? relativeTime(d.nextAttemptAt) : "—"}</TableCell>
                <TableCell className="text-muted-foreground tabular"><LocalTime value={d.createdAt} /></TableCell>
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
                            ? { id: d.id, ok: r.value.ok, text: r.value.ok ? `Delivered (HTTP ${r.value.statusCode})` : `Failed${r.value.statusCode ? ` (HTTP ${r.value.statusCode})` : ""}${r.value.error ? `: ${r.value.error}` : ""}` }
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
              {expanded && (
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell />
                  <TableCell colSpan={7} className="whitespace-normal">
                    <p className="mb-2 text-xs text-muted-foreground">
                      Event <span className="font-mono">{d.eventId}</span> · delivery <span className="font-mono">{d.id}</span>
                    </p>
                    {d.attemptLog.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No attempts yet.</p>
                    ) : (
                      <ol className="flex flex-col gap-2">
                        {d.attemptLog.map((a) => {
                          const ok = a.statusCode !== null && a.statusCode >= 200 && a.statusCode < 300;
                          return (
                            <li key={a.id} className="rounded-lg border bg-card p-3 text-xs">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="font-medium">Attempt {a.attempt}</span>
                                <Badge tone={ok ? "success" : "danger"}>{a.statusCode ?? "No response"}</Badge>
                                {a.durationMs !== null && <span className="text-muted-foreground tabular">{a.durationMs} ms</span>}
                                <span className="text-muted-foreground"><LocalTime value={a.createdAt} /></span>
                              </div>
                              {a.error && <p className="mt-1.5 text-destructive">{a.error}</p>}
                              {a.responseBody && (
                                <pre className="mt-2 max-h-32 overflow-auto rounded-md bg-muted p-2 font-mono text-[11px] whitespace-pre-wrap">{a.responseBody}</pre>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
