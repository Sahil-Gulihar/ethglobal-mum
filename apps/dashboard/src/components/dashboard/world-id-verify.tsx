"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IDKitRequestWidget, proofOfHuman, type IDKitResult } from "@worldcoin/idkit";
import { completeWorldIdVerification, startWorldIdVerification, type WorldIdRequest } from "@/lib/actions/world-id";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/icons";

export function WorldIdVerifyButton({ label = "Verify with World ID" }: { label?: string }) {
  const router = useRouter();
  const [request, setRequest] = useState<WorldIdRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    setError(null);
    startTransition(async () => {
      const r = await startWorldIdVerification();
      if (!r.ok) return setError(r.error);
      setRequest(r.value);
      setOpen(true);
    });
  }

  async function verify(result: IDKitResult) {
    const r = await completeWorldIdVerification(result);
    if (!r.ok) {
      setError(r.error);
      throw new Error(r.error); // tells the widget the host rejected the proof
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={start} disabled={pending}>
          {pending ? <Spinner /> : <Icon name="shield" />} {label}
        </Button>
        {request?.environment === "staging" && (
          <a href="https://simulator.worldcoin.org" target="_blank" rel="noreferrer" className="text-sm text-muted-foreground underline underline-offset-4">
            Testing? Open the World ID simulator
          </a>
        )}
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {request && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={request.appId}
          action={request.action}
          rp_context={request.rpContext}
          allow_legacy_proofs={true}
          preset={proofOfHuman({ signal: request.signal })}
          environment={request.environment}
          handleVerify={verify}
          onSuccess={() => {
            setRequest(null);
            router.refresh();
          }}
          onError={(code) => {
            setError((e) => e ?? `World ID verification didn't finish (${code}).`);
          }}
        />
      )}
    </div>
  );
}
