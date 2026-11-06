"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWebhookEndpoint } from "@/lib/actions/webhooks";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function AddWebhookForm({ onAdded }: { onAdded?: () => void }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const r = await createWebhookEndpoint(url);
          if (!r.ok) setError(r.error);
          else {
            setUrl("");
            onAdded?.();
            router.refresh();
          }
        });
      }}
    >
      <Label htmlFor="webhook-url">Endpoint URL</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="webhook-url"
          name="webhook-url"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://your-store.com/api/webhooks/whitechain"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "webhook-url-error" : "webhook-url-hint"}
          required
        />
        <Button type="submit" disabled={pending || !url.trim()} className="shrink-0">
          {pending && <Spinner />} Add endpoint
        </Button>
      </div>
      {error ? (
        <FieldError id="webhook-url-error">{error}</FieldError>
      ) : (
        <p id="webhook-url-hint" className="text-xs text-muted-foreground">
          We&apos;ll POST signed <code className="font-mono">payment.succeeded</code> and <code className="font-mono">refund.succeeded</code> events here.
        </p>
      )}
    </form>
  );
}
