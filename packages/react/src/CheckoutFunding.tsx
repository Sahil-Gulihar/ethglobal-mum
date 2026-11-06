import { useEffect, useRef, useState } from "react";
import { formatEther, formatUnits, TransactionReceiptNotFoundError, type Address, type Hash } from "viem";
import { explorerTx, type PublicCheckoutSession } from "@whitechain-commerce/core";
import { apiFetch } from "./api.ts";
import { bridge, fundingBalances, fundingStatus, SEPOLIA_ID, swap, WBT_GAS_RESERVE, type Asset, type Quote } from "./funding-chain.ts";
import { hasErrorCode, isUserRejection, WHITECHAIN_CHAIN_ID } from "./state.ts";
import type { Eip1193Provider } from "./wallets.ts";

type Pending = { kind: "bridge" | "swap"; hash: Hash };
type Plan =
  | { kind: "swap"; quote: Quote }
  | { kind: "bridge"; amount: bigint; output: bigint; deadline: number }
  | { kind: "switch" }
  | { kind: "funded" };

interface Props {
  account: Address;
  apiBase: string;
  chainId: number | null;
  provider: Eip1193Provider;
  session: PublicCheckoutSession;
  balance: bigint | null;
  needsFunds: boolean;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onRefresh: () => void;
  onSepolia: () => void;
}

function savedTransfer(key: string): Pending | null {
  try {
    const item = JSON.parse(localStorage.getItem(key) ?? "null");
    if ((item?.kind === "bridge" || item?.kind === "swap") && /^0x[a-f0-9]{64}$/i.test(item.hash)) return item;
  } catch {
    // Browser storage can be disabled.
  }
  return null;
}

export function CheckoutFunding(p: Props) {
  const { account, apiBase, chainId, provider, session } = p;
  const storageKey = `whitechain-commerce:funding:1874:${account.toLowerCase()}`;
  const [pending, setPending] = useState<Pending | null>(() => savedTransfer(storageKey));
  const [plan, setPlan] = useState<Plan | null>(null);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const onRefresh = p.onRefresh;

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const status = await fundingStatus(pending.kind, pending.hash);
        if (cancelled) return;
        try { localStorage.removeItem(storageKey); } catch { /* storage unavailable */ }
        setPending(null);
        if (status === "reverted") {
          setError("The funding transaction failed. Check the transaction before retrying.");
        } else if (pending.kind === "bridge") {
          setMessage("ETH arrived on Whitechain. Swap the bridged ETH to USDT to continue.");
        } else {
          setMessage("Swap confirmed. Your USDT balance is refreshing.");
        }
        onRefresh();
      } catch (err) {
        if (cancelled) return;
        if (!(err instanceof TransactionReceiptNotFoundError)) {
          setError("Couldn’t check the transaction. Checkout will keep trying.");
        } else {
          setError("");
        }
        timer = setTimeout(poll, 5000);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [onRefresh, pending, storageKey]);

  const onWhitechain = chainId === WHITECHAIN_CHAIN_ID;
  const onSepolia = chainId === SEPOLIA_ID;
  const shouldQuote = !pending && (onSepolia || (onWhitechain && p.needsFunds && p.balance !== null));

  useEffect(() => {
    if (!shouldQuote) return;
    const abort = new AbortController();
    setPlan(null);
    setError("");
    const calculate = async () => {
      const { usdt, eth, wbt } = await fundingBalances(account);
      const shortfall = BigInt(session.amountUnits) - usdt;
      if (shortfall <= 0n) return { kind: "funded" } as const;
      if (wbt <= WBT_GAS_RESERVE) throw new Error("Get WBT on Whitechain to cover the swap and payment fees.");

      const quote = async (asset: Asset) => {
        const result = await apiFetch<{ amountIn: string; amountOut: string; fee: number }>(
          `${apiBase}/api/v1/checkout_sessions/${encodeURIComponent(session.id)}/swap_quote`,
          { method: "POST", signal: abort.signal, body: JSON.stringify({ asset, amount: shortfall.toString(), side: "EXACT_OUTPUT" }) },
        );
        const input = BigInt(result.amountIn);
        if (input <= 0n || result.amountOut !== shortfall.toString() || ![100, 500, 3000, 10000].includes(result.fee)) {
          throw new Error("Invalid swap quote.");
        }
        const maximum = (input * 10050n + 9999n) / 10000n;
        return { asset, input, maximum, output: shortfall, fee: result.fee, deadline: Math.floor(Date.now() / 1000) + 120 };
      };

      if (onSepolia || eth > 0n) {
        const q = await quote("ETH");
        if (eth >= q.input) {
          if (onSepolia) return { kind: "switch" } as const;
          return { kind: "swap", quote: { ...q, maximum: eth < q.maximum ? eth : q.maximum } } as const;
        }
        if (onSepolia) {
          // Leave room for the price to move while the deposit is in transit.
          return { kind: "bridge", amount: (q.input * 10200n + 9999n) / 10000n - eth, output: shortfall, deadline: q.deadline } as const;
        }
      }
      const q = await quote("WBT");
      if (q.maximum + WBT_GAS_RESERVE >= wbt) throw new Error("This wallet needs more WBT to cover the swap and fees.");
      return { kind: "swap", quote: q } as const;
    };

    void calculate().then(
      (next) => { if (!abort.signal.aborted) setPlan(next); },
      (err: unknown) => { if (!abort.signal.aborted) setError(err instanceof Error ? err.message : "Couldn’t calculate the funding amount."); },
    );
    return () => abort.abort();
  }, [account, apiBase, onSepolia, p.balance, revision, session.amountUnits, session.id, shouldQuote]);

  useEffect(() => {
    if (!shouldQuote || !plan || p.busy || plan.kind === "funded") return;
    const refresh = setTimeout(() => setRevision((current) => current + 1), 90_000);
    return () => clearTimeout(refresh);
  }, [p.busy, plan, shouldQuote]);

  async function run(action: () => Promise<void>) {
    if (p.busy || inFlight.current || pending) return;
    inFlight.current = true;
    p.onBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (err) {
      setError(isUserRejection(err) ? "You canceled the request in your wallet."
        : err instanceof Error && "shortMessage" in err ? String(err.shortMessage)
        : err instanceof Error ? err.message : "Funding failed. Try again.");
    } finally {
      inFlight.current = false;
      p.onBusy(false);
    }
  }

  const assertActive = async () => {
    if (Date.now() >= Date.parse(session.expiresAt)) throw new Error("This checkout has expired.");
    const [accounts, chain] = await Promise.all([
      provider.request({ method: "eth_accounts" }) as Promise<string[]>,
      provider.request({ method: "eth_chainId" }) as Promise<string>,
    ]);
    if (accounts[0]?.toLowerCase() !== account.toLowerCase() || Number(chain) !== chainId) {
      throw new Error("Your wallet changed. Check your account and network before retrying.");
    }
  };

  function save(kind: Pending["kind"], hash: Hash) {
    const tx = { kind, hash };
    try { localStorage.setItem(storageKey, JSON.stringify(tx)); } catch { /* storage unavailable */ }
    setPending(tx);
    setPlan(null);
  }

  if (onWhitechain && !p.needsFunds && !pending && !message) return null;
  return (
    <div className="wcc-funding">
      <p className="wcc-title">Fund this checkout</p>
      {error ? <p className="wcc-alert" data-kind="warn" role="alert">{error}</p> : null}
      {message ? <p className="wcc-text" role="status">{message}</p> : null}
      {pending ? (
        <p className="wcc-text" role="status">
          {pending.kind === "bridge" ? "Waiting for ETH to arrive on Whitechain. This can take a few minutes. " : "Waiting for your swap to confirm. "}
          <a href={pending.kind === "bridge" ? `https://sepolia.etherscan.io/tx/${pending.hash}` : explorerTx(pending.hash)}
            target="_blank" rel="noreferrer">View transaction</a>
        </p>
      ) : !onWhitechain || p.needsFunds ? (
        <>
          {shouldQuote && !plan && !error ? <p className="wcc-text" role="status">Calculating how much you need…</p> : null}
          {shouldQuote && !plan && error ? (
            <button type="button" className="wcc-link-btn" onClick={() => setRevision((current) => current + 1)}>Retry</button>
          ) : null}
          {plan?.kind === "swap" || plan?.kind === "bridge" ? (
            <div className="wcc-funding-actions">
              <p className="wcc-text">
                {plan.kind === "swap"
                  ? `Get ${formatUnits(plan.quote.output, session.decimals)} USDT. Maximum ${formatEther(plan.quote.maximum)} ${plan.quote.asset}, plus network fees.`
                  : `Bridge ${formatEther(plan.amount)} Sepolia ETH to cover about ${formatUnits(plan.output, session.decimals)} USDT. Keep ETH on Sepolia and WBT on Whitechain for fees.`}
              </p>
              <button type="button" className="wcc-btn" disabled={p.busy} onClick={() => void run(async () => {
                const wallet = { account, provider, assertActive };
                await assertActive();
                if (Date.now() >= (plan.kind === "swap" ? plan.quote.deadline : plan.deadline) * 1000) {
                  setRevision((current) => current + 1);
                  return;
                }
                if (plan.kind === "bridge") save("bridge", await bridge(wallet, plan.amount));
                else save("swap", await swap(wallet, plan.quote));
              })}>
                {p.busy ? "Waiting for wallet or network…" : plan.kind === "bridge" ? "Bridge ETH" : `Swap ${plan.quote.asset} to USDT`}
              </button>
            </div>
          ) : null}
          {onSepolia && plan?.kind === "switch" && !message ? (
            <p className="wcc-text">Your bridged ETH is on Whitechain. Switch networks to swap it.</p>
          ) : null}
          {!onSepolia ? (
            <button type="button" className="wcc-link-btn" disabled={p.busy} onClick={p.onSepolia}>Use Ethereum Sepolia funds</button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export async function switchToSepolia(provider: Eip1193Provider) {
  const chainId = `0x${SEPOLIA_ID.toString(16)}`;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (err) {
    if (!hasErrorCode(err, 4902)) throw err;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId, chainName: "Ethereum Sepolia", nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"], blockExplorerUrls: ["https://sepolia.etherscan.io"],
      }],
    });
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  }
}
