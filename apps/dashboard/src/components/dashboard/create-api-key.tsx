"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createApiKey } from "@/lib/actions/api-keys";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, FieldError } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/copy-button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/icons";

export function CreateApiKeyButton({ disabled, variant = "default" }: { disabled?: boolean; variant?: "default" | "outline" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setKey(null);
    setName("");
    setError(null);
    router.refresh();
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} disabled={disabled}>
        <Icon name="plus" /> Create secret key
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : close())}
        title={key ? "Save your secret key" : "Create secret key"}
        description={key ? "This is the only time we'll show it. Store it in your server environment as WC_SECRET_KEY." : "Use it on your server to create checkout sessions. Never ship it to the browser."}
      >
        {key ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/60 p-2 pl-3">
              <code className="min-w-0 flex-1 truncate font-mono text-sm" title={key}>
                {key}
              </code>
              <CopyButton value={key} label="Copy key" showLabel />
            </div>
            <Alert tone="warning">Copy it now. You won&apos;t be able to see this key again.</Alert>
            <Button onClick={close} className="self-end">
              I&apos;ve saved it
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              startTransition(async () => {
                const r = await createApiKey(name);
                if (r.ok) setKey(r.value.key);
                else setError(r.error);
              });
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="key-name">Name</Label>
              <Input id="key-name" name="key-name" autoComplete="off" placeholder="e.g. Production store" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </div>
            <FieldError>{error}</FieldError>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Spinner />} Create key
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
