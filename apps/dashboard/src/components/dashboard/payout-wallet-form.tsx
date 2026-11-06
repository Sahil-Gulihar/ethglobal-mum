"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { isAddress } from "viem";
import { setPayoutAddress } from "@/lib/actions/merchant";
import { WalletProvider } from "@/components/wallet/wallet-provider";
import { useWallet, walletErrorMessage } from "@/components/wallet/use-wallet";
import { ExplorerLink } from "@/components/dashboard/explorer-link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/icons";
import { shortAddr } from "@/lib/utils";

type Props = { currentPayout: string | null; currentTxHash: string | null; submitLabel?: string };

export function PayoutWalletForm(props: Props) {
  return (
    <WalletProvider>
      <PayoutWalletFormInner {...props} />
    </WalletProvider>
  );
}

function PayoutWalletFormInner({ currentPayout, currentTxHash, submitLabel = "Use as payout wallet" }: Props) {
  const router = useRouter();
  const wallet = useWallet();
  const [manual, setManual] = useState(false);
  const [manualAddr, setManualAddr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ payoutAddress: string; txHash: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const target = manual ? manualAddr.trim() : wallet.address ?? "";
  const sameAsCurrent = !!currentPayout && target.toLowerCase() === currentPayout.toLowerCase();

  function submit() {
    setError(null);
    setDone(null);
    if (!isAddress(target, { strict: false })) {
      setError("Enter a valid 0x wallet address.");
      return;
    }
    startTransition(async () => {
      const r = await setPayoutAddress(target);
      if (!r.ok) setError(r.error);
      else {
        setDone(r.value);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {currentPayout && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-sm border-[0.5px] bg-muted/50 px-3 py-2.5 text-sm">
          <span className="text-muted-foreground">Current payout</span>
          <ExplorerLink address={currentPayout} label={shortAddr(currentPayout, 10, 8)} />
          {currentTxHash && (
            <span className="text-xs text-muted-foreground">
              registered in <ExplorerLink hash={currentTxHash} />
            </span>
          )}
        </div>
      )}

      {!manual ? (
        <div className="flex flex-col gap-3">
          {wallet.isConnected && wallet.address ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border-[0.5px] px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-sm bg-accent text-accent-foreground">
                  <Icon name="wallet" />
                </span>
                <div className="flex flex-col">
                  <span className="font-mono text-sm">{shortAddr(wallet.address, 10, 8)}</span>
                  <span className="text-xs text-muted-foreground">Connected browser wallet</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={wallet.disconnect}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                setError(null);
                wallet.connect().catch((e) => setError(walletErrorMessage(e)));
              }}
              disabled={wallet.isConnecting}
              className="w-full sm:w-fit"
            >
              {wallet.isConnecting ? <Spinner /> : <Icon name="wallet" />}
              {wallet.isConnecting ? "Connecting…" : "Connect wallet"}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            You won&apos;t sign anything. We register this address onchain so payments settle directly to it, and refunds are signed from it.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="payout-address">Payout address</Label>
          <Input
            id="payout-address"
            name="payout-address"
            autoComplete="off"
            spellCheck={false}
            placeholder="0x…"
            className="font-mono"
            value={manualAddr}
            onChange={(e) => setManualAddr(e.target.value)}
            aria-invalid={!!error}
          />
        </div>
      )}

      <FieldError>{error}</FieldError>
      {pending && (
        <Alert tone="info">
          <span className="flex items-center gap-2">
            <Spinner /> Registering {shortAddr(target)} on Whitechain. This takes a few seconds…
          </span>
        </Alert>
      )}
      {done && !pending && (
        <Alert tone="success">
          <span className="flex flex-wrap items-center gap-2">
            <Icon name="check" /> Payout wallet registered onchain. <ExplorerLink hash={done.txHash} label="View transaction" />
          </span>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={pending || !target || sameAsCurrent}>
          {pending && <Spinner />}
          {pending ? "Registering…" : sameAsCurrent ? "Already your payout wallet" : submitLabel}
        </Button>
        <button
          type="button"
          onClick={() => {
            setManual((v) => !v);
            setError(null);
          }}
          className="rounded text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {manual ? "Connect a wallet instead" : "Paste an address instead"}
        </button>
      </div>
    </div>
  );
}
