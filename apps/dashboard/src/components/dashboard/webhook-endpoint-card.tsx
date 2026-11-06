"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteWebhookEndpoint,
  revealWebhookSecret,
  sendTestWebhook,
  setWebhookEndpointEnabled,
  type AttemptSummary,
} from "@/lib/actions/webhooks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/icons";
import { formatDate } from "@/lib/utils";

export type EndpointCardProps = { id: string; url: string; enabled: boolean; createdAt: string; secretHint: string };

export function WebhookEndpointCard({ id, url, enabled, createdAt, secretHint }: EndpointCardProps) {
  const router = useRouter();
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<AttemptSummary | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<null | "reveal" | "toggle" | "test" | "delete">(null);
  const [, startTransition] = useTransition();

  function act(kind: NonNullable<typeof busy>, fn: () => Promise<void>) {
    setError(null);
    setBusy(kind);
    startTransition(async () => {
      try {
        await fn();
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-mono text-sm font-medium" title={url}>
              {url}
            </span>
            <Badge tone={enabled ? "success" : "neutral"} dot>
              {enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Added {formatDate(createdAt)} · payment.succeeded, refund.succeeded
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={!!busy || !enabled}
            title={enabled ? undefined : "Enable the endpoint to send a test"}
            onClick={() =>
              act("test", async () => {
                setTest(null);
                const r = await sendTestWebhook(id);
                if (!r.ok) setError(r.error);
                else setTest(r.value);
                router.refresh();
              })
            }
          >
            {busy === "test" ? <Spinner /> : <Icon name="send" />} Send test event
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!!busy}
            onClick={() =>
              act("toggle", async () => {
                const r = await setWebhookEndpointEnabled(id, !enabled);
                if (!r.ok) setError(r.error);
                router.refresh();
              })
            }
          >
            {busy === "toggle" && <Spinner />} {enabled ? "Disable" : "Enable"}
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" disabled={!!busy} onClick={() => setConfirmDelete(true)}>
            <Icon name="trash" /> Delete
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-sm border bg-muted/50 py-1.5 pr-1.5 pl-3">
        <span className="text-xs font-medium text-muted-foreground">Signing secret</span>
        <code className="min-w-0 flex-1 truncate font-mono text-xs">{secret ?? `${secretHint}`}</code>
        {secret ? (
          <>
            <CopyButton value={secret} label="Copy signing secret" showLabel />
            <Button variant="ghost" size="sm" onClick={() => setSecret(null)}>
              Hide
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={!!busy}
            onClick={() =>
              act("reveal", async () => {
                const r = await revealWebhookSecret(id);
                if (r.ok) setSecret(r.value);
                else setError(r.error);
              })
            }
          >
            {busy === "reveal" ? <Spinner /> : <Icon name="eye" />} Reveal
          </Button>
        )}
      </div>

      {error && <Alert tone="danger">{error}</Alert>}
      {test && (
        <Alert tone={test.ok ? "success" : "warning"}>
          {test.ok
            ? `Test event delivered: HTTP ${test.statusCode} in ${test.durationMs} ms.`
            : `Test event failed${test.statusCode ? ` with HTTP ${test.statusCode}` : ""}${test.error && test.error !== `HTTP ${test.statusCode}` ? `: ${test.error}` : ""}. Test events aren't retried; fix the endpoint and send another.`}
        </Alert>
      )}

      <Dialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        dismissible={busy !== "delete"}
        title="Delete endpoint?"
        description="We'll stop sending events to this URL and remove its delivery log."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy === "delete"}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy === "delete"}
            onClick={() =>
              act("delete", async () => {
                const r = await deleteWebhookEndpoint(id);
                if (!r.ok) setError(r.error);
                setConfirmDelete(false);
                router.refresh();
              })
            }
          >
            {busy === "delete" && <Spinner />} Delete endpoint
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
