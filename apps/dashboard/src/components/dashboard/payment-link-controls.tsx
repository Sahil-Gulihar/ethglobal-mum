"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPaymentLink, setPaymentLinkActive } from "@/lib/actions/payment-links";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldError, Input, Label } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/copy-button";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/icons";

export function CreatePaymentLinkButton({ disabled, appUrl }: { disabled?: boolean; appUrl: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setName("");
    setAmount("");
    setCreated(null);
    setError(null);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={disabled}>
        <Icon name="plus" /> Create payment link
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : close())}
        dismissible={!pending}
        title={created ? "Your payment link is ready" : "Create payment link"}
        description={
          created
            ? "Share it anywhere. Each visit opens a fresh USDT checkout for this amount."
            : "A shareable URL that takes a fixed USDT payment. No website or code needed."
        }
      >
        {created ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/60 p-2 pl-3">
              <code className="min-w-0 flex-1 truncate font-mono text-sm" title={created}>
                {created}
              </code>
              <CopyButton value={created} label="Copy link" showLabel />
            </div>
            <Button onClick={close} className="self-end">
              Done
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              startTransition(async () => {
                const r = await createPaymentLink({ name, amount });
                if (!r.ok) setError(r.error);
                else {
                  setCreated(`${appUrl}/pay/${r.value.id}`);
                  router.refresh();
                }
              });
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="pl-name">Name</Label>
              <Input
                id="pl-name"
                name="pl-name"
                autoComplete="off"
                placeholder="e.g. 30-min consulting call"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pl-amount">Amount (USDT)</Label>
              <Input
                id="pl-amount"
                name="pl-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="25.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="tabular"
                required
              />
            </div>
            <FieldError>{error}</FieldError>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !name.trim() || !amount.trim()}>
                {pending && <Spinner />} Create link
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}

export function TogglePaymentLinkButton({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await setPaymentLinkActive(id, !active);
            if (!r.ok) setError(r.error);
            else router.refresh();
          })
        }
      >
        {pending && <Spinner />} {active ? "Turn off" : "Turn on"}
      </Button>
    </span>
  );
}
