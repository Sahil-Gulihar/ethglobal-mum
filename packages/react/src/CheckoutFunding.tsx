import { useEffect, useRef, useState } from "react";
import { formatEther, formatUnits, parseEther, TransactionReceiptNotFoundError, type Address, type Hash } from "viem";
import { explorerTx, type PublicCheckoutSession } from "@whitechain-commerce/core";
import { apiFetch } from "./api.ts";
import { bridge, fundingStatus, SEPOLIA_ID, swap, type Asset, type Quote } from "./funding-chain.ts";
import { hasErrorCode, isUserRejection, WHITECHAIN_CHAIN_ID } from "./state.ts";
import type { Eip1193Provider } from "./wallets.ts";

type Pending = { kind: "bridge" | "swap"; hash: Hash };
type Mode = Asset | "bridge";

interface Props {
  account: Address;
  apiBase: string;
  chainId: number | null;
  provider: Eip1193Provider;
  session: PublicCheckoutSession;
  needsFunds: boolean;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onWhitechain: () => void;
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
  const [mode, setMode] = useState<Mode | null>(null);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [message, setMessage] = useState("");
  const [bridged, setBridged] = useState(false);
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
          setBridged(true);
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

  function select(next: Mode) {
    setMode(next);
    setQuote(null);
    setAmount("");
    setError("");
  }

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

  function enteredAmount() {
    if (!/^\d{1,12}(\.\d{1,18})?$/.test(amount) || parseEther(amount) === 0n) {
      throw new Error("Enter a positive amount with up to 18 decimal places.");
    }
    return parseEther(amount);
  }

  function save(kind: Pending["kind"], hash: Hash) {
    const tx = { kind, hash };
    try { localStorage.setItem(storageKey, JSON.stringify(tx)); } catch { /* storage unavailable */ }
    setPending(tx);
    setQuote(null);
    setMode(null);
  }

  const onWhitechain = chainId === WHITECHAIN_CHAIN_ID;
  const onSepolia = chainId === SEPOLIA_ID;
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
          <div className="wcc-funding-actions">
            {onWhitechain ? (
              <>
                <button type="button" className="wcc-link-btn" disabled={p.busy} onClick={() => select("WBT")}>Swap WBT to USDT</button>
                <button type="button" className="wcc-link-btn" disabled={p.busy} onClick={() => select("ETH")}>Swap bridged ETH to USDT</button>
              </>
            ) : null}
            {onSepolia ? (
              <>
                <button type="button" className="wcc-link-btn" disabled={p.busy} onClick={() => select("bridge")}>Bridge Sepolia ETH</button>
                {bridged ? <button type="button" className="wcc-link-btn" disabled={p.busy} onClick={p.onWhitechain}>Switch to Whitechain to swap</button> : null}
              </>
            ) : (
              <button type="button" className="wcc-link-btn" disabled={p.busy} onClick={p.onSepolia}>Use Ethereum Sepolia funds</button>
            )}
          </div>
          {mode && (mode === "bridge" ? onSepolia : onWhitechain) ? (
            <form className="wcc-funding-form" onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const wallet = { account, provider, assertActive };
                await assertActive();
                if (mode === "bridge") {
                  save("bridge", await bridge(wallet, enteredAmount()));
                } else if (quote) {
                  setQuote(null);
                  if (Date.now() >= quote.deadline * 1000) throw new Error("This quote expired. Get a fresh quote.");
                  save("swap", await swap(wallet, quote));
                } else {
                  const input = enteredAmount();
                  const result = await apiFetch<{ amountOut: string; fee: number }>(
                    `${apiBase}/api/v1/checkout_sessions/${encodeURIComponent(session.id)}/swap_quote`,
                    { method: "POST", body: JSON.stringify({ asset: mode, amount: input.toString() }) },
                  );
                  const output = BigInt(result.amountOut);
                  const minimum = output * 9950n / 10000n;
                  if (minimum <= 0n || ![100, 500, 3000, 10000].includes(result.fee)) throw new Error("Invalid swap quote.");
                  setQuote({ asset: mode, amount: input, output, minimum, fee: result.fee, deadline: Math.floor(Date.now() / 1000) + 120 });
                }
              });
            }}>
              <label>
                {mode === "WBT" ? "WBT to swap" : mode === "ETH" ? "Bridged ETH to swap" : "Sepolia ETH to bridge"}
                <input value={amount} inputMode="decimal" required disabled={p.busy} onChange={(event) => {
                  setAmount(event.target.value);
                  setQuote(null);
                }} />
              </label>
              <p className="wcc-text">
                {mode === "bridge" ? "You may need to confirm wrapping, approval, and the deposit. Leave ETH for Sepolia fees and keep WBT on Whitechain for the swap and payment."
                  : "Keep at least 0.01 WBT after swap fees for checkout."}
              </p>
              {quote ? <p className="wcc-text">Swap {formatEther(quote.amount)} {quote.asset} for about {formatUnits(quote.output, session.decimals)} USDT. Minimum {formatUnits(quote.minimum, session.decimals)} USDT.</p> : null}
              <button type="submit" className="wcc-btn" disabled={p.busy}>
                {p.busy ? "Waiting…" : mode === "bridge" ? "Bridge ETH" : quote ? "Confirm swap" : "Get swap quote"}
              </button>
            </form>
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
