"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWriteContract } from "wagmi";
import { erc20Abi, fromUnits, paymentRouterAbi, toUnits, USDT_ADDRESS, whitechainSepolia } from "@whitechain-commerce/core";
import { cancelPendingRefund, indexRefundTx, payoutTokenState, startRefund, txStatus } from "@/lib/actions/refunds";
import { WalletProvider } from "@/components/wallet/wallet-provider";
import { useWallet, walletErrorMessage } from "@/components/wallet/use-wallet";
import { ExplorerLink } from "@/components/dashboard/explorer-link";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/icons";
import { formatAmount, shortAddr } from "@/lib/utils";

export type RefundPanelProps = {
  paymentId: string;
  chainPaymentId: `0x${string}`;
  /** Merchant's CURRENT payout wallet; only it may call refund() onchain. */
  payout: string | null;
  router: `0x${string}`;
  decimals: number;
  refundableUnits: string;
  /** Pending requests (e.g. created via the API) that still need a signature. */
  pending: { id: string; amountUnits: string; txHash: string | null }[];
};

type Phase =
  | { k: "idle" }
  | { k: "preparing" }
  | { k: "approving"; hash?: string }
  | { k: "refunding"; hash?: string }
  | { k: "indexing"; hash: string }
  | { k: "done"; hash: string; indexed: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForTx(hash: string, timeoutMs = 120_000): Promise<"success" | "reverted"> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const r = await txStatus(hash);
    if (r.ok && r.value !== "pending") return r.value;
    await sleep(2000);
  }
  throw new Error("Timed out waiting for the transaction. Check the explorer; the dashboard updates once it confirms.");
}

export function RefundPanel(props: RefundPanelProps) {
  return (
    <WalletProvider>
      <RefundPanelInner {...props} />
    </WalletProvider>
  );
}

function RefundPanelInner({ paymentId, chainPaymentId, payout, router: routerAddress, decimals, refundableUnits, pending }: RefundPanelProps) {
  const nav = useRouter();
  const wallet = useWallet();
  const write = useWriteContract();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<{ refundId: string; amountUnits: string; created: boolean } | null>(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ k: "idle" });

  const remaining = BigInt(refundableUnits);
  const busy = phase.k !== "idle" && phase.k !== "done";
  const wrongAccount = !!(wallet.address && payout && wallet.address.toLowerCase() !== payout.toLowerCase());
  const unsigned = pending.filter((p) => !p.txHash);

  const [discarding, setDiscarding] = useState<string | null>(null);

  async function discard(refundId: string) {
    setDiscarding(refundId);
    const r = await cancelPendingRefund(refundId);
    setDiscarding(null);
    if (!r.ok) setError(r.error);
    nav.refresh();
  }

  function openNew() {
    setTarget(null);
    setAmount(""); // no prefill, so a full refund is never sent by accident
    setError(null);
    setPhase({ k: "idle" });
    setOpen(true);
  }

  function openExisting(p: { id: string; amountUnits: string }) {
    setTarget({ refundId: p.id, amountUnits: p.amountUnits, created: false });
    setAmount(fromUnits(p.amountUnits, decimals));
    setError(null);
    setPhase({ k: "idle" });
    setOpen(true);
  }

  function close() {
    if (busy) return;
    setOpen(false);
    nav.refresh();
  }

  async function run() {
    setError(null);
    if (!payout) return setError("Connect a payout wallet in Settings first.");
    if (!wallet.isConnected || !wallet.address) {
      try {
        await wallet.connect();
      } catch (e) {
        return setError(walletErrorMessage(e));
      }
      return; // re-render with the connected account; the merchant clicks again after checking it
    }
    if (wrongAccount) return setError(`Switch your wallet to the payout account ${shortAddr(payout)}. Only it can sign refunds.`);
    if (!wallet.onRightChain) {
      try {
        await wallet.switchToWhitechain();
      } catch (e) {
        return setError(walletErrorMessage(e));
      }
    }

    // 1. Validate the amount and record the pending refund (so the indexer can match the event).
    setPhase({ k: "preparing" });
    let t = target;
    if (!t) {
      let units: bigint;
      try {
        units = toUnits(amount.trim(), decimals);
      } catch {
        setPhase({ k: "idle" });
        return setError("Enter a valid amount greater than 0.");
      }
      if (units > remaining) {
        setPhase({ k: "idle" });
        return setError(`You can refund at most ${formatAmount(fromUnits(remaining, decimals))} USDT.`);
      }
      const r = await startRefund(paymentId, amount.trim());
      if (!r.ok) {
        setPhase({ k: "idle" });
        return setError(r.error);
      }
      t = { refundId: r.value.refundId, amountUnits: r.value.amountUnits, created: true };
      setTarget(t);
    }
    const units = BigInt(t.amountUnits);
    let broadcast = false;
    let reverted = false;

    try {
      // 2. Balance + allowance of the payout wallet.
      const st = await payoutTokenState(wallet.address);
      if (!st.ok) throw new Error(st.error);
      if (BigInt(st.value.balance) < units) {
        throw new Error(`Your payout wallet holds ${formatAmount(fromUnits(st.value.balance, decimals))} USDT, not enough for this refund.`);
      }
      if (BigInt(st.value.allowance) < units) {
        setPhase({ k: "approving" });
        const approveHash = await write.mutateAsync({
          address: USDT_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [routerAddress, units],
          chainId: whitechainSepolia.id,
        });
        setPhase({ k: "approving", hash: approveHash });
        if ((await waitForTx(approveHash)) !== "success") throw new Error("The approval transaction reverted.");
      }

      // 3. refund(paymentId, amount) from the payout wallet. USDT moves payout -> payer.
      setPhase({ k: "refunding" });
      const hash = await write.mutateAsync({
        address: routerAddress,
        abi: paymentRouterAbi,
        functionName: "refund",
        args: [chainPaymentId, units],
        chainId: whitechainSepolia.id,
      });
      broadcast = true;
      setPhase({ k: "refunding", hash });
      if ((await waitForTx(hash)) !== "success") {
        reverted = true;
        throw new Error("The refund transaction reverted onchain. No USDT moved.");
      }

      // 4. Validate right away (the worker would do the same on its next pass).
      setPhase({ k: "indexing", hash });
      let indexed = false;
      for (let i = 0; i < 5 && !indexed; i++) {
        const r = await indexRefundTx(paymentId, hash);
        indexed = r.ok && r.value;
        if (!indexed) await sleep(2000);
      }
      setPhase({ k: "done", hash, indexed });
      nav.refresh();
    } catch (e) {
      // Nothing was broadcast (or it reverted, so nothing moved): drop the request so its amount isn't reserved.
      // A timed-out broadcast keeps its row; the merchant can discard it from the payment page.
      if ((!broadcast || reverted) && t.created) {
        await cancelPendingRefund(t.refundId).catch(() => undefined);
        setTarget(null);
      }
      setPhase({ k: "idle" });
      setError(walletErrorMessage(e));
    }
  }

  const hashOf = "hash" in phase ? phase.hash : undefined;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {unsigned.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => openExisting(p)}>
              <Icon name="undo" /> Sign pending {formatAmount(fromUnits(p.amountUnits, decimals))} USDT refund
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={discarding === p.id}
              onClick={() => void discard(p.id)}
              aria-label={`Discard pending ${formatAmount(fromUnits(p.amountUnits, decimals))} USDT refund`}
            >
              {discarding === p.id ? <Spinner /> : null} Discard
            </Button>
          </span>
        ))}
        <Button variant="outline" onClick={openNew} disabled={remaining === 0n}>
          <Icon name="undo" /> {remaining === 0n ? "Fully refunded" : "Refund"}
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : close())}
        dismissible={!busy}
        title={phase.k === "done" ? "Refund sent" : "Refund payment"}
        description={
          phase.k === "done"
            ? "USDT went straight from your payout wallet back to the customer."
            : "Refunds are signed from your payout wallet. We never hold funds, so the USDT comes from that wallet."
        }
      >
        {phase.k === "done" ? (
          <div className="flex flex-col gap-4">
            <Alert tone={phase.indexed ? "success" : "info"}>
              <span className="flex flex-wrap items-center gap-2">
                <Icon name="check" />
                {phase.indexed ? "Confirmed and recorded." : "Confirmed onchain. It will show as succeeded shortly."}
                <ExplorerLink hash={phase.hash} label="View transaction" />
              </span>
            </Alert>
            <Button onClick={close} className="self-end">
              Done
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="refund-amount">Amount</Label>
              <div className="relative">
                <Input
                  id="refund-amount"
                  name="refund-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  className={target ? "pr-16 tabular" : "pr-28 tabular"}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={busy || !!target}
                  aria-describedby="refund-amount-hint"
                />
                <span className="absolute inset-y-0 right-3 flex items-center gap-2 text-sm text-muted-foreground">
                  {!target && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setAmount(fromUnits(remaining, decimals))}
                      className="rounded px-1.5 py-0.5 text-xs font-medium text-primary outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      Max
                    </button>
                  )}
                  <span className="pointer-events-none">USDT</span>
                </span>
              </div>
              <p id="refund-amount-hint" className="text-xs text-muted-foreground">
                {target
                  ? "Amount fixed by the pending refund request."
                  : `Up to ${formatAmount(fromUnits(remaining, decimals))} USDT. Partial refunds are fine.`}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Icon name="wallet" /> Payout wallet
              </span>
              <span className="font-mono text-xs">{payout ? shortAddr(payout, 8, 6) : "Not set"}</span>
            </div>
            {wallet.isConnected && wallet.address && (
              <p className={wrongAccount ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>
                Connected: <span className="font-mono">{shortAddr(wallet.address, 8, 6)}</span>
                {wrongAccount ? " (not your payout wallet; switch accounts in your wallet)" : " (matches)"}
              </p>
            )}

            <FieldError>{error}</FieldError>

            {busy && (
              <Alert tone="info">
                <span className="flex flex-wrap items-center gap-2">
                  <Spinner />
                  {phase.k === "preparing" && "Preparing refund…"}
                  {phase.k === "approving" && (hashOf ? "Waiting for the approval to confirm…" : "Approve USDT spending in your wallet…")}
                  {phase.k === "refunding" && (hashOf ? "Waiting for the refund to confirm…" : "Confirm the refund in your wallet…")}
                  {phase.k === "indexing" && "Recording the refund…"}
                  {hashOf && <ExplorerLink hash={hashOf} />}
                </span>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !payout}>
                {busy && <Spinner />}
                {!wallet.isConnected ? "Connect payout wallet" : wrongAccount ? "Wrong wallet connected" : "Send refund"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
