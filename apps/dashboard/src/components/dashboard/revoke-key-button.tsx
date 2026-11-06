"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeApiKey } from "@/lib/actions/api-keys";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function RevokeKeyButton({ id, prefix }: { id: string; prefix: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setOpen(true)}>
        Revoke
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        dismissible={!pending}
        title="Revoke secret key?"
        description={
          <>
            Requests using <span className="font-mono">{prefix}…</span> will fail immediately. This can&apos;t be undone.
          </>
        }
      >
        <FieldError>{error}</FieldError>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await revokeApiKey(id);
                if (!r.ok) setError(r.error);
                else {
                  setOpen(false);
                  router.refresh();
                }
              })
            }
          >
            {pending && <Spinner />} Revoke key
          </Button>
        </div>
      </Dialog>
    </>
  );
}
