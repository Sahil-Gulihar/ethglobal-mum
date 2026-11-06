"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  fallback,
  http,
  type PublicClient,
  type WalletClient,
} from "viem";
import {
  erc20Abi,
  EXPLORER_URL,
  explorerTx,
  fromUnits,
  paymentRouterAbi,
  PUBLIC_RPC_URL,
  whitechainSepolia,
  type PublicCheckoutSession,
} from "@whitechain-commerce/core";
import { getSession, resolveApiBase, submitTx } from "./api";
import {
  amountUnits,
  canPay,
  errorMessage,
  formatCountdown,
  hasErrorCode,
  initialState,
  insufficientBalance,
  insufficientGas,
  isPrePay,
  isUserRejection,
  needsApproval,
  reducer,
  steps,
  WHITECHAIN_CHAIN_ID,
  type State,
} from "./state";
import { CSS } from "./styles";
import { lastWallet, rememberWallet, watchWallets, type DetectedWallet, type Eip1193Provider } from "./wallets";

export const FAUCET_URL = "https://faucet.testnet.whitechain.io";
const METAMASK_URL = "https://metamask.io/download/";
const POLL_MS = 2000;
const BALANCE_REFRESH_MS = 8000;

export interface CheckoutSuccess {
  sessionId: string;
  orderId: string;
  paymentId: string;
  txHash: `0x${string}`;
  explorerUrl: string;
  /** The session's successUrl, if the merchant set one. */
  successUrl: string | null;
  /** True when the session was already paid when the widget loaded (no payment happened just now). */
  alreadyPaid: boolean;
}

export interface WhitechainCheckoutProps {
  sessionId: string;
  /** API origin, e.g. "http://localhost:3000". Defaults to NEXT_PUBLIC_WC_API_BASE, then "" (same origin). */
  apiBase?: string;
  /** UI only. Fulfil orders from the verified webhook, never from this callback. Called once. */
  onSuccess?: (result: CheckoutSuccess) => void;
  /** Called on failures (not on user rejections in the wallet, which are shown inline with a retry). */
  onError?: (error: Error) => void;
  /** Called when the customer clicks Cancel. If omitted and the session has a cancelUrl, we navigate there. */
  onCancel?: () => void;
  /** "auto" (default) follows the OS colour scheme live; "light" or "dark" forces one. */
  theme?: "light" | "dark" | "auto";
  className?: string;
}

const CHAIN_HEX = `0x${WHITECHAIN_CHAIN_ID.toString(16)}`;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** "1234.5" -> "1,234.50" (keeps up to 6 decimals, at least 2). */
function formatAmount(units: bigint, decimals: number): string {
  const [i, f = ""] = fromUnits(units, decimals).split(".");
  const frac = f.replace(/0+$/, "").padEnd(2, "0");
  return `${BigInt(i!).toLocaleString("en-US")}.${frac}`;
}

export function WhitechainCheckout(props: WhitechainCheckoutProps) {
  const { sessionId, theme = "auto", className } = props;
  const apiBase = useMemo(() => resolveApiBase(props.apiBase), [props.apiBase]);
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef<State>(state);
  stateRef.current = state;

  const cbs = useRef(props);
  cbs.current = props;
  const reportError = useCallback((err: unknown) => {
    if (isUserRejection(err)) return;
    const e = err instanceof Error ? err : new Error(errorMessage(err));
    try {
      cbs.current.onError?.(e);
    } catch {
      /* host callback threw */
    }
  }, []);
  const fail = useCallback(
    (err: unknown) => {
      dispatch({ type: "FAIL", message: errorMessage(err) });
      reportError(err);
    },
    [reportError],
  );

  // ---------- wallets ----------
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);
  const [walletsSettled, setWalletsSettled] = useState(false);
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);

  useEffect(
    () =>
      watchWallets((list, settled) => {
        setWallets(list);
        setWalletsSettled(settled);
      }),
    [],
  );

  const publicClient: PublicClient = useMemo(
    () =>
      createPublicClient({
        chain: whitechainSepolia,
        // Prefer the wallet's own RPC once connected (it is on chain 1874 whenever we read); public RPC as backup.
        transport: provider ? fallback([custom(provider), http(PUBLIC_RPC_URL)]) : http(PUBLIC_RPC_URL),
        pollingInterval: 1500,
      }) as PublicClient,
    [provider],
  );
  const walletClient: WalletClient | null = useMemo(
    () => (provider ? createWalletClient({ chain: whitechainSepolia, transport: custom(provider) }) : null),
    [provider],
  );

  const connect = useCallback(
    async (wallet: DetectedWallet, silent = false) => {
      dispatch({ type: "CONNECT_START", walletId: wallet.id });
      try {
        const accounts = (await wallet.provider.request({
          method: silent ? "eth_accounts" : "eth_requestAccounts",
        })) as string[];
        if (!accounts?.length) {
          if (silent) return dispatch({ type: "DISCONNECT" });
          throw new Error("No account returned by the wallet");
        }
        const chainId = parseInt((await wallet.provider.request({ method: "eth_chainId" })) as string, 16);
        setProvider(wallet.provider);
        rememberWallet(wallet.id);
        dispatch({ type: "CONNECTED", walletId: wallet.id, account: accounts[0] as `0x${string}`, chainId });
      } catch (err) {
        if (silent) return dispatch({ type: "DISCONNECT" });
        if (hasErrorCode(err, -32002)) {
          dispatch({ type: "FAIL", message: "A connection request is already open. Check your wallet." });
          return;
        }
        fail(err);
      }
    },
    [fail],
  );

  // Silent reconnect to the last-used wallet once discovery settles.
  const triedSilent = useRef(false);
  useEffect(() => {
    if (triedSilent.current || state.phase !== "connect" || wallets.length === 0) return;
    const last = lastWallet();
    const match = wallets.find((w) => w.id === last);
    if (!match && !walletsSettled) return;
    triedSilent.current = true;
    if (match) void connect(match, true);
  }, [state.phase, wallets, walletsSettled, connect]);

  // Wallet events.
  useEffect(() => {
    if (!provider?.on) return;
    const onAccounts = (accounts: string[]) => dispatch({ type: "ACCOUNTS_CHANGED", accounts: accounts ?? [] });
    const onChain = (hex: string) => dispatch({ type: "CHAIN_CHANGED", chainId: parseInt(hex, 16) });
    const onDisconnect = () => dispatch({ type: "ACCOUNTS_CHANGED", accounts: [] });
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    provider.on("disconnect", onDisconnect);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
      provider.removeListener?.("disconnect", onDisconnect);
    };
  }, [provider]);

  const switchNetwork = useCallback(async () => {
    if (!provider) return;
    dispatch({ type: "SWITCH_START" });
    try {
      try {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
      } catch (err) {
        if (!hasErrorCode(err, 4902)) throw err;
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: CHAIN_HEX,
              chainName: whitechainSepolia.name,
              nativeCurrency: whitechainSepolia.nativeCurrency,
              rpcUrls: [PUBLIC_RPC_URL],
              blockExplorerUrls: [EXPLORER_URL],
            },
          ],
        });
      }
      const chainId = parseInt((await provider.request({ method: "eth_chainId" })) as string, 16);
      if (chainId !== WHITECHAIN_CHAIN_ID)
        throw new Error("Your wallet is still on another network. Switch to Whitechain Sepolia to continue.");
      dispatch({ type: "CHAIN_CHANGED", chainId });
    } catch (err) {
      fail(err);
    }
  }, [provider, fail]);

  // ---------- session ----------
  useEffect(() => {
    if (state.phase !== "loading") return;
    const ac = new AbortController();
    getSession(apiBase, sessionId, ac.signal)
      .then((session) => dispatch({ type: "SESSION_LOADED", session }))
      .catch((err) => {
        if (ac.signal.aborted) return;
        dispatch({ type: "LOAD_FAILED", message: errorMessage(err) });
        reportError(err);
      });
    return () => ac.abort();
  }, [state.phase, apiBase, sessionId, reportError]);

  // Expiry countdown (only matters before the payment is sent).
  const [now, setNow] = useState(() => Date.now());
  const prePay = isPrePay(state.phase);
  useEffect(() => {
    if (!prePay) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [prePay]);
  const msLeft = state.session ? new Date(state.session.expiresAt).getTime() - now : Infinity;
  useEffect(() => {
    if (prePay && state.session && msLeft <= 0) dispatch({ type: "EXPIRE" });
  }, [prePay, msLeft, state.session]);

  // Balance / allowance / gas reads while reviewing.
  const reviewKey = state.phase === "review" ? `${state.account}` : null;
  useEffect(() => {
    if (!reviewKey) return;
    const s = stateRef.current;
    const session = s.session;
    const account = s.account;
    if (!session || !account) return;
    let cancelled = false;
    const read = async () => {
      try {
        const [balance, allowance, gas] = await Promise.all([
          publicClient.readContract({
            address: session.tokenAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [account],
          }),
          publicClient.readContract({
            address: session.tokenAddress,
            abi: erc20Abi,
            functionName: "allowance",
            args: [account, session.routerAddress],
          }),
          publicClient.getBalance({ address: account }),
        ]);
        if (!cancelled) dispatch({ type: "BALANCES_LOADED", balance, allowance, gas });
      } catch (err) {
        if (!cancelled && stateRef.current.balance === null)
          dispatch({ type: "FAIL", message: `Could not read your USDT balance: ${errorMessage(err)}` });
      }
    };
    void read();
    const t = setInterval(read, BALANCE_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [reviewKey, publicClient]);

  // ---------- pay ----------
  const pay = useCallback(async () => {
    const s = stateRef.current;
    const session = s.session;
    const account = s.account;
    if (!canPay(s) || !session || !account || !walletClient) return;
    const amount = amountUnits(s);
    try {
      if (needsApproval(s)) {
        dispatch({ type: "APPROVE_START" });
        // Tether-style tokens reject changing a non-zero allowance; reset to 0 first if needed.
        if ((s.allowance ?? 0n) > 0n) {
          const ok = await publicClient
            .simulateContract({
              account,
              address: session.tokenAddress,
              abi: erc20Abi,
              functionName: "approve",
              args: [session.routerAddress, amount],
            })
            .then(
              () => true,
              () => false,
            );
          if (!ok) {
            const h0 = await walletClient.writeContract({
              account,
              chain: whitechainSepolia,
              address: session.tokenAddress,
              abi: erc20Abi,
              functionName: "approve",
              args: [session.routerAddress, 0n],
            });
            dispatch({ type: "APPROVE_SENT", hash: h0 });
            await publicClient.waitForTransactionReceipt({ hash: h0 });
          }
        }
        const hash = await walletClient.writeContract({
          account,
          chain: whitechainSepolia,
          address: session.tokenAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [session.routerAddress, amount],
        });
        dispatch({ type: "APPROVE_SENT", hash });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("The USDT approval transaction reverted.");
        const allowance = await publicClient.readContract({
          address: session.tokenAddress,
          abi: erc20Abi,
          functionName: "allowance",
          args: [account, session.routerAddress],
        });
        if (allowance < amount)
          throw new Error("Approval confirmed but the allowance is still too low. Please try again.");
        dispatch({ type: "APPROVE_CONFIRMED", allowance });
      }

      dispatch({ type: "PAY_START" });
      // Simulate first so revert reasons (already paid, unregistered merchant...) surface before signing.
      const { request } = await publicClient.simulateContract({
        account,
        address: session.routerAddress,
        abi: paymentRouterAbi,
        functionName: "pay",
        args: [session.chainMerchantId, session.chainOrderId, amount],
      });
      const hash = await walletClient.writeContract({ ...request, chain: whitechainSepolia });
      dispatch({ type: "PAY_SENT", hash });
      // Tell the backend; it validates onchain itself. The indexer finds the tx even if this fails.
      submitTx(apiBase, session.id, hash).catch(() =>
        setTimeout(() => submitTx(apiBase, session.id, hash).catch(reportError), 3000),
      );
    } catch (err) {
      fail(err);
    }
  }, [walletClient, publicClient, apiBase, fail, reportError]);

  // Watch our own pay tx for a revert while the backend validates.
  useEffect(() => {
    const hash = state.payTx;
    if (!hash || state.phase !== "confirming") return;
    let cancelled = false;
    publicClient
      .waitForTransactionReceipt({ hash, timeout: 180_000 })
      .then((r) => {
        if (!cancelled && r.status !== "success")
          dispatch({
            type: "PAY_REVERTED",
            message: "The payment transaction reverted onchain. No funds moved; you can try again.",
          });
      })
      .catch(() => {
        /* keep polling the backend */
      });
    return () => {
      cancelled = true;
    };
  }, [state.payTx, state.phase, publicClient]);

  // Poll the backend until the session is validated as paid.
  useEffect(() => {
    if (state.phase !== "confirming") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const session = await getSession(apiBase, sessionId);
        if (!cancelled) dispatch({ type: "SESSION_POLLED", session });
      } catch {
        /* tolerate transient errors */
      }
      if (!cancelled) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state.phase, apiBase, sessionId]);

  // onSuccess, exactly once.
  const successFired = useRef(false);
  const result: CheckoutSuccess | null = useMemo(() => {
    const session = state.session;
    if (state.phase !== "success" || !session) return null;
    const txHash = (session.payment?.txHash ?? state.payTx)!;
    return {
      sessionId: session.id,
      orderId: session.orderId,
      paymentId: session.payment?.id ?? "",
      txHash,
      explorerUrl: session.payment?.explorerUrl ?? (txHash ? explorerTx(txHash) : ""),
      successUrl: session.successUrl,
      alreadyPaid: state.alreadyPaid,
    };
  }, [state.phase, state.session, state.payTx, state.alreadyPaid]);
  useEffect(() => {
    if (!result || successFired.current) return;
    successFired.current = true;
    try {
      cbs.current.onSuccess?.(result);
    } catch {
      /* host callback threw */
    }
  }, [result]);

  const cancel = useCallback(() => {
    if (cbs.current.onCancel) return cbs.current.onCancel();
    const url = stateRef.current.session?.cancelUrl;
    if (url) window.location.href = url;
  }, []);

  const disconnect = useCallback(() => {
    rememberWallet(null);
    setProvider(null);
    dispatch({ type: "DISCONNECT" });
  }, []);

  return (
    <div className={`wcc-root${className ? ` ${className}` : ""}`} data-theme={theme}>
      <style>{CSS}</style>
      <View
        state={state}
        msLeft={msLeft}
        wallets={wallets}
        walletsSettled={walletsSettled}
        result={result}
        canCancel={Boolean(props.onCancel || state.session?.cancelUrl)}
        onConnect={(w) => void connect(w)}
        onSwitch={() => void switchNetwork()}
        onPay={() => void pay()}
        onRetryLoad={() => dispatch({ type: "RETRY_LOAD" })}
        onDismissError={() => dispatch({ type: "CLEAR_ERROR" })}
        onDisconnect={disconnect}
        onCancel={cancel}
      />
      <p className="wcc-sr" role="status" aria-live="polite">
        {announce(state)}
      </p>
      <footer className="wcc-foot">
        <LockIcon />
        <span>Non-custodial</span>
        <span className="wcc-foot-sep" aria-hidden>
          ·
        </span>
        <span>
          Powered by <b>Whitechain Commerce</b>
        </span>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Presentational pieces
// ---------------------------------------------------------------------------------------------

export interface ViewProps {
  state: State;
  msLeft: number;
  wallets: DetectedWallet[];
  walletsSettled: boolean;
  result: CheckoutSuccess | null;
  canCancel: boolean;
  onConnect: (w: DetectedWallet) => void;
  onSwitch: () => void;
  onPay: () => void;
  onRetryLoad: () => void;
  onDismissError: () => void;
  onDisconnect: () => void;
  onCancel: () => void;
}

/** Short status line for screen readers (announced on phase changes and errors). */
function announce(s: State): string {
  if (s.error) return s.error;
  switch (s.phase) {
    case "connecting":
      return "Connecting to your wallet.";
    case "wrong_network":
      return "Switch your wallet to Whitechain to continue.";
    case "review":
      return "Wallet connected. Review the payment.";
    case "approving":
      return s.waiting === "chain" ? "Waiting for the approval to confirm." : "Approve USDT spending in your wallet.";
    case "paying":
      return "Confirm the payment in your wallet.";
    case "confirming":
      return "Confirming payment.";
    case "success":
      return "Payment complete.";
    case "expired":
      return "This checkout has expired.";
    default:
      return "";
  }
}

/** Header metadata on the right: the countdown before paying, a status label after. */
function HeadMeta({ state, msLeft }: { state: State; msLeft: number }) {
  const countdown = formatCountdown(msLeft);
  if (isPrePay(state.phase) && countdown)
    return (
      <span className="wcc-meta" data-urgent={msLeft < 120_000} title="Time left to pay">
        <ClockIcon />
        <span>
          <span className="wcc-sr">Expires in </span>
          {countdown}
        </span>
      </span>
    );
  switch (state.phase) {
    case "approving":
    case "paying":
    case "confirming":
      return (
        <span className="wcc-meta">
          <span className="wcc-dot" data-kind="warn" /> Processing
        </span>
      );
    case "success":
      return (
        <span className="wcc-meta">
          <span className="wcc-dot" /> Paid
        </span>
      );
    case "expired":
      return (
        <span className="wcc-meta">
          <span className="wcc-dot" data-kind="muted" /> Expired
        </span>
      );
    default:
      return null;
  }
}

/** Internal: pure view, exported for previews/tests only (not part of the public API). */
export function View(p: ViewProps) {
  const { state } = p;
  const session = state.session;

  if (state.phase === "load_error" && !session)
    return (
      <section className="wcc-body" data-center="true">
        <div className="wcc-main">
          <div className="wcc-badge" data-kind="error">
            <AlertIcon size={20} />
          </div>
          <h2 className="wcc-title">We couldn't load this checkout</h2>
          <p className="wcc-text">{state.error}</p>
        </div>
        <div className="wcc-actions">
          <button type="button" className="wcc-btn" onClick={p.onRetryLoad}>
            Try again
          </button>
        </div>
      </section>
    );
  if (!session) return <Skeleton />;

  const amountLabel = formatAmount(BigInt(session.amountUnits), session.decimals);

  return (
    <>
      <header className="wcc-head">
        <div className="wcc-avatar" aria-hidden>
          {session.merchant.name.trim().charAt(0).toUpperCase() || "W"}
        </div>
        <div className="wcc-merchant">
          <div className="wcc-merchant-name">{session.merchant.name}</div>
          <div className="wcc-merchant-sub">
            <span>Order</span>
            <span className="wcc-mono" title={session.orderId}>
              {session.orderId}
            </span>
          </div>
        </div>
        <HeadMeta state={state} msLeft={p.msLeft} />
      </header>
      <div className="wcc-amount">
        <div className="wcc-label">{state.phase === "success" ? "You paid" : "Amount due"}</div>
        <div className="wcc-amount-row">
          <span className="wcc-amount-value">{amountLabel}</span>
          <span className="wcc-amount-cur">USDT</span>
        </div>
        <div className="wcc-net">
          <span className="wcc-dot" /> Whitechain Sepolia
        </div>
      </div>
      <div className="wcc-sep" />
      <Body {...p} amountLabel={amountLabel} />
    </>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <div className="wcc-alert" role="alert">
      <AlertIcon size={16} />
      <span>{message}</span>
      <button type="button" className="wcc-alert-x" aria-label="Dismiss" onClick={onDismiss}>
        <CloseIcon />
      </button>
    </div>
  );
}

function CancelButton({ show, onCancel }: { show: boolean; onCancel: () => void }) {
  if (!show) return null;
  return (
    <button type="button" className="wcc-btn-ghost" onClick={onCancel}>
      Cancel and return to store
    </button>
  );
}

function Body(p: ViewProps & { amountLabel: string }) {
  const { state, amountLabel } = p;
  const session = state.session as PublicCheckoutSession;
  const merchant = session.merchant.name.replace(/\.+$/, "");

  switch (state.phase) {
    case "expired":
      return (
        <section className="wcc-body" data-center="true" key="expired">
          <div className="wcc-main">
            <div className="wcc-badge">
              <ClockIcon size={20} />
            </div>
            <h2 className="wcc-title">This checkout has expired</h2>
            <p className="wcc-text">No payment was taken. Return to the store to start a new checkout.</p>
          </div>
          {session.cancelUrl ? (
            <div className="wcc-actions">
              <a className="wcc-btn" href={session.cancelUrl}>
                Return to store
              </a>
            </div>
          ) : null}
        </section>
      );

    case "success": {
      const r = p.result;
      return (
        <section className="wcc-body" key="success">
          <div className="wcc-main" style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div className="wcc-badge" data-kind="success" style={{ margin: 0 }}>
              <svg className="wcc-check" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div style={{ minWidth: 0, paddingTop: 0 }}>
              <h2 className="wcc-title">{state.alreadyPaid ? "This order is already paid" : "Payment complete"}</h2>
              <p className="wcc-text">
                {amountLabel} USDT sent to {merchant}, settled on Whitechain.
              </p>
            </div>
          </div>
          <dl className="wcc-rows">
            <div className="wcc-row">
              <dt>Status</dt>
              <dd className="wcc-success-text">
                <CheckSmallIcon /> Succeeded
              </dd>
            </div>
            {r?.txHash ? (
              <div className="wcc-row">
                <dt>Transaction</dt>
                <dd>
                  <a className="wcc-mono" href={r.explorerUrl} target="_blank" rel="noreferrer" title={r.txHash}>
                    {short(r.txHash)}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="wcc-actions">
            {session.successUrl ? (
              <a className="wcc-btn" href={session.successUrl}>
                Return to store
              </a>
            ) : null}
            {r?.explorerUrl ? (
              <a
                className={session.successUrl ? "wcc-btn-ghost" : "wcc-btn-2"}
                href={r.explorerUrl}
                target="_blank"
                rel="noreferrer"
              >
                View on Whitechain explorer <ArrowIcon />
              </a>
            ) : null}
          </div>
        </section>
      );
    }

    case "connect":
    case "connecting": {
      const none = p.walletsSettled && p.wallets.length === 0;
      const discovering = !p.walletsSettled && p.wallets.length === 0;
      return (
        <section className="wcc-body" key="connect">
          <h2 className="wcc-title">Pay with your wallet</h2>
          <p className="wcc-text">Connect a wallet that holds USDT on Whitechain Sepolia.</p>
          <ErrorBanner message={state.error} onDismiss={p.onDismissError} />
          {none ? (
            <div className="wcc-alert" data-kind="info">
              <WalletIcon size={16} />
              <span>
                No wallet found in this browser.{" "}
                <a href={METAMASK_URL} target="_blank" rel="noreferrer">
                  Install MetaMask
                </a>
                , then reload this page.
              </span>
            </div>
          ) : (
            <div className="wcc-wallets">
              {discovering ? (
                <span className="wcc-skel" style={{ height: 48 }} aria-label="Looking for wallets" />
              ) : (
                p.wallets.map((w) => {
                  const busy = state.phase === "connecting" && state.walletId === w.id;
                  return (
                    <button
                      type="button"
                      key={w.id}
                      className="wcc-wallet"
                      data-busy={busy}
                      disabled={state.phase === "connecting"}
                      onClick={() => p.onConnect(w)}
                    >
                      {w.icon ? (
                        <img src={w.icon} alt="" />
                      ) : (
                        <span className="wcc-wallet-icon">
                          <WalletIcon size={14} />
                        </span>
                      )}
                      <span className="wcc-wallet-name">{w.name}</span>
                      {busy ? (
                        <span className="wcc-wallet-hint">
                          <span className="wcc-spin" data-size="sm" /> Connecting
                        </span>
                      ) : (
                        <span className="wcc-wallet-hint">
                          Connect <ChevronIcon />
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
          <div className="wcc-actions">
            {state.phase === "connecting" ? (
              <p className="wcc-note">Approve the connection in your wallet.</p>
            ) : (
              <CancelButton show={p.canCancel} onCancel={p.onCancel} />
            )}
          </div>
        </section>
      );
    }

    case "wrong_network":
    case "switching": {
      const switching = state.phase === "switching";
      return (
        <section className="wcc-body" key="network">
          <h2 className="wcc-title">Switch to Whitechain Sepolia</h2>
          <p className="wcc-text">Your wallet is on another network. Payments settle on Whitechain Sepolia.</p>
          <ErrorBanner message={state.error} onDismiss={p.onDismissError} />
          <dl className="wcc-rows">
            <AccountRow state={state} onDisconnect={p.onDisconnect} />
            <div className="wcc-row">
              <dt>Wallet network</dt>
              <dd>
                <span className="wcc-dot" data-kind="warn" />
                {state.chainId !== null ? (
                  <span>
                    Chain <span className="wcc-mono">{state.chainId}</span>
                  </span>
                ) : (
                  "Unknown"
                )}
              </dd>
            </div>
          </dl>
          <div className="wcc-actions">
            <button type="button" className="wcc-btn" data-busy={switching} disabled={switching} onClick={p.onSwitch}>
              {switching ? (
                <>
                  <span className="wcc-spin" /> Confirm in your wallet…
                </>
              ) : (
                "Switch network"
              )}
            </button>
            <CancelButton show={p.canCancel} onCancel={p.onCancel} />
          </div>
        </section>
      );
    }

    case "review":
      return <ReviewBody {...p} />;

    default:
      return <ProgressBody {...p} />;
  }
}

function AccountRow({ state, onDisconnect }: { state: State; onDisconnect?: () => void }) {
  if (!state.account) return null;
  return (
    <div className="wcc-row">
      <dt>Pay from</dt>
      <dd>
        <span className="wcc-mono" title={state.account}>
          {short(state.account)}
        </span>
        {onDisconnect && isPrePay(state.phase) ? (
          <button type="button" className="wcc-link-btn" onClick={onDisconnect}>
            Change
          </button>
        ) : null}
      </dd>
    </div>
  );
}

function ReviewBody(p: ViewProps & { amountLabel: string }) {
  const { state, amountLabel } = p;
  const session = state.session as PublicCheckoutSession;
  const loaded = state.balance !== null && state.allowance !== null;
  const lowBalance = insufficientBalance(state);
  const noGas = insufficientGas(state);
  const approval = needsApproval(state);

  return (
    <section className="wcc-body" key="review">
      <h2 className="wcc-title">Review and pay</h2>
      <p className="wcc-text">
        {approval
          ? "Your wallet asks twice: once to approve this USDT amount, then to pay."
          : "Your wallet will ask you to confirm one transaction."}
      </p>
      <ErrorBanner message={state.error} onDismiss={p.onDismissError} />
      {lowBalance ? (
        <div className="wcc-alert" data-kind="warn">
          <AlertIcon size={16} />
          <span>
            Not enough USDT in this wallet. Top up from the{" "}
            <a href={FAUCET_URL} target="_blank" rel="noreferrer">
              Whitechain faucet
            </a>
            . Your balance refreshes automatically.
          </span>
        </div>
      ) : noGas ? (
        <div className="wcc-alert" data-kind="warn">
          <AlertIcon size={16} />
          <span>
            You need a little WBT for network fees. Get some from the{" "}
            <a href={FAUCET_URL} target="_blank" rel="noreferrer">
              Whitechain faucet
            </a>
            .
          </span>
        </div>
      ) : null}
      <dl className="wcc-rows">
        <AccountRow state={state} onDisconnect={p.onDisconnect} />
        <div className="wcc-row">
          <dt>Balance</dt>
          <dd data-bad={lowBalance}>
            {state.balance === null ? (
              <span className="wcc-skel" style={{ width: 88, height: 16 }} aria-label="Loading balance" />
            ) : (
              `${formatAmount(state.balance, session.decimals)} USDT`
            )}
          </dd>
        </div>
      </dl>
      <div className="wcc-actions">
        <button type="button" className="wcc-btn" data-busy={!loaded} disabled={!canPay(state)} onClick={p.onPay}>
          {!loaded ? (
            <>
              <span className="wcc-spin" /> Checking balance…
            </>
          ) : approval ? (
            `Approve and pay ${amountLabel} USDT`
          ) : (
            `Pay ${amountLabel} USDT`
          )}
        </button>
        <CancelButton show={p.canCancel} onCancel={p.onCancel} />
      </div>
    </section>
  );
}

/** approving, paying and confirming: a progress list with the current step spinning. */
function ProgressBody(p: ViewProps & { amountLabel: string }) {
  const { state, amountLabel } = p;
  const stepList = steps(state);

  let title: string;
  let text: string;
  let note: ReactNode;
  if (state.phase === "approving") {
    title = state.waiting === "chain" ? "Waiting for the approval" : "Approve USDT";
    text =
      state.waiting === "chain"
        ? "Your approval is confirming on Whitechain. The payment request comes next."
        : `Allow the payment contract to transfer ${amountLabel} USDT from your wallet.`;
    note = state.waiting === "chain" ? "Usually takes a few seconds." : "Check your wallet to continue.";
  } else if (state.phase === "paying") {
    title = "Confirm the payment";
    text = `Confirm the ${amountLabel} USDT payment in your wallet.`;
    note = "Check your wallet to continue.";
  } else {
    title = "Confirming payment";
    text = "Your transaction is on Whitechain. We're verifying it now.";
    note = "Usually takes a few seconds. You can keep this page open.";
  }

  const buttonLabel =
    state.phase === "approving"
      ? state.waiting === "chain"
        ? "Confirming approval…"
        : "Approve in your wallet…"
      : state.phase === "paying"
        ? "Confirm in your wallet…"
        : "Confirming payment…";

  return (
    <section className="wcc-body" key="progress">
      <h2 className="wcc-title">{title}</h2>
      <p className="wcc-text">{text}</p>
      <ol className="wcc-steps" aria-label="Payment progress">
        {stepList.map((s, i) => {
          const txLink =
            s.status === "active" && s.key === "approve" && state.approveTx
              ? explorerTx(state.approveTx)
              : s.status === "active" && s.key === "confirm" && state.payTx
                ? explorerTx(state.payTx)
                : null;
          return (
            <li key={s.key} className="wcc-step" data-s={s.status} aria-current={s.status === "active" ? "step" : undefined}>
              <span className="wcc-step-ic">
                {s.status === "done" ? (
                  <TickIcon />
                ) : s.status === "active" ? (
                  <span className="wcc-spin" data-size="sm" />
                ) : (
                  i + 1
                )}
              </span>
              <span>
                {s.label}
                <span className="wcc-sr">{s.status === "done" ? " (done)" : s.status === "active" ? " (in progress)" : ""}</span>
              </span>
              {txLink ? (
                <a className="wcc-step-note" href={txLink} target="_blank" rel="noreferrer">
                  View transaction
                </a>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="wcc-actions">
        <button type="button" className="wcc-btn" data-busy="true" disabled>
          <span className="wcc-spin" /> {buttonLabel}
        </button>
        <p className="wcc-note">
          {state.phase === "confirming" && state.payTx ? (
            <>
              <span className="wcc-mono">{short(state.payTx)}</span>
              <span aria-hidden>·</span>
              <span>{note}</span>
            </>
          ) : (
            note
          )}
        </p>
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading checkout">
      <div className="wcc-head">
        <span className="wcc-skel" style={{ width: 32, height: 32 }} />
        <div style={{ flex: 1 }}>
          <span className="wcc-skel" style={{ width: 120, height: 14, marginBottom: 6 }} />
          <span className="wcc-skel" style={{ width: 160, height: 12 }} />
        </div>
      </div>
      <div className="wcc-amount">
        <span className="wcc-skel" style={{ width: 88, height: 14, marginBottom: 10 }} />
        <span className="wcc-skel" style={{ width: 168, height: 34 }} />
        <span className="wcc-skel" style={{ width: 128, height: 12, marginTop: 14 }} />
      </div>
      <div className="wcc-sep" />
      <div className="wcc-body" style={{ animation: "none" }}>
        <span className="wcc-skel" style={{ width: 150, height: 18 }} />
        <span className="wcc-skel" style={{ width: 260, height: 14, marginTop: 8 }} />
        <span className="wcc-skel" style={{ height: 48, marginTop: 16 }} />
      </div>
    </div>
  );
}

// ---------- icons ----------
const LockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flex: "none" }}>
    <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M8 11V8a4 4 0 118 0v3" stroke="currentColor" strokeWidth="2" />
  </svg>
);
const ClockIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ flex: "none" }}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const AlertIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ flex: "none", marginTop: size < 20 ? 1 : 0 }}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    <path d="M12 7.5v5.5M12 16.2v.3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);
const WalletIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ flex: "none", marginTop: 1 }}>
    <rect x="3" y="6" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="2" />
    <path d="M16 12.5h2M3 9h15a3 3 0 013 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const TickIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CheckSmallIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flex: "none" }}>
    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flex: "none" }}>
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flex: "none" }}>
    <path d="M8 16L16 8M9 8h7v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
