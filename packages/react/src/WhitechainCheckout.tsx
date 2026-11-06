"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { LockIcon as LockShape, Clock01Icon, AlertCircleIcon, Wallet01Icon, Tick01Icon } from "@hugeicons/core-free-icons";

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
import { getSession, resolveApiBase, submitTx, WhitechainApiError } from "./api.js";
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
} from "./state.js";
import { CSS } from "./styles.js";
import { lastWallet, rememberWallet, watchWallets, type DetectedWallet, type Eip1193Provider } from "./wallets.js";

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
  theme?: "light" | "dark";
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
  const { sessionId, theme = "light", className } = props;
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
    (err: unknown, message: string) => {
      dispatch({ type: "FAIL", message: isUserRejection(err) ? "You canceled the request in your wallet." : message });
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
        fail(err, "We couldn’t connect your wallet. Open your wallet and try again.");
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
        throw new Error("Your wallet is still on another network. Switch networks to continue.");
      dispatch({ type: "CHAIN_CHANGED", chainId });
    } catch (err) {
      fail(err, "We couldn’t switch networks. Choose Whitechain in your wallet and try again.");
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
        const message = err instanceof WhitechainApiError && err.status === 404
          ? "This payment link couldn’t be found. Ask the store for a new link."
          : "Check your connection and try again.";
        dispatch({ type: "LOAD_FAILED", message });
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
          dispatch({ type: "FAIL", message: "We couldn’t check your balance. Check your connection and try again." });
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
      fail(err, "We couldn’t complete the payment. Check your wallet before trying again.");
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
            message: "The payment didn’t go through. You can try again.",
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
        <span>Pay directly from your wallet</span>
        <span className="wcc-foot-sep">·</span>
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

/** Internal: pure view, exported for previews/tests only (not part of the public API). */
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
      return s.waiting === "chain" ? "Waiting for your wallet approval." : "Allow this checkout to use your USDT.";
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

export function View(p: ViewProps) {
  const { state } = p;
  const session = state.session;

  if (state.phase === "loading" || !session) {
    if (state.phase === "load_error")
      return (
        <section className="wcc-body" style={{ paddingTop: 28 }}>
          <div className="wcc-center">
            <div className="wcc-badge-ic" data-kind="muted">
              <AlertIcon />
            </div>
            <p className="wcc-title">We couldn't load this checkout</p>
            <p className="wcc-text">{state.error}</p>
            <button className="wcc-btn" onClick={p.onRetryLoad}>
              Try again
            </button>
          </div>
        </section>
      );
    return <Skeleton />;
  }

  const decimals = session.decimals;
  const amountLabel = formatAmount(BigInt(session.amountUnits), decimals);
  const countdown = formatCountdown(p.msLeft);
  const showTimer = isPrePay(state.phase) && countdown;

  return (
    <>
      <header className="wcc-head">
        <div className="wcc-avatar" aria-hidden>
          {session.merchant.name.trim().charAt(0).toUpperCase() || "W"}
        </div>
        <div className="wcc-merchant">
          <div className="wcc-merchant-name">{session.merchant.name}</div>
          <div className="wcc-merchant-sub">Order {session.orderId}</div>
        </div>
        {showTimer ? (
          <span className="wcc-pill" data-urgent={p.msLeft < 120_000} title="Time left to pay">
            <ClockIcon /> {countdown}
          </span>
        ) : null}
      </header>
      <div className="wcc-amount">
        <div className="wcc-label">{state.phase === "success" ? "You paid" : "Amount due"}</div>
        <div className="wcc-amount-row">
          <span className="wcc-amount-value">{amountLabel}</span>
          <span className="wcc-amount-cur">
            <UsdtIcon /> USDT
          </span>
        </div>
      </div>
      <div className="wcc-divider" />
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
      <button className="wcc-alert-x" aria-label="Dismiss" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}

function Body(p: ViewProps & { amountLabel: string }) {
  const { state, amountLabel } = p;
  const session = state.session as PublicCheckoutSession;
  const cancelLink = p.canCancel ? (
    <button className="wcc-btn-ghost" onClick={p.onCancel}>
      Cancel and return to store
    </button>
  ) : null;

  switch (state.phase) {
    case "expired":
      return (
        <section className="wcc-body" key="expired">
          <div className="wcc-center">
            <div className="wcc-badge-ic" data-kind="muted">
              <ClockIcon size={28} />
            </div>
            <p className="wcc-title">This checkout has expired</p>
            <p className="wcc-text">No payment was taken. Return to the store to start a new checkout.</p>
          </div>
          {session.cancelUrl ? (
            <a className="wcc-btn" href={session.cancelUrl}>
              Return to store
            </a>
          ) : null}
        </section>
      );

    case "success": {
      const r = p.result;
      return (
        <section className="wcc-body" key="success">
          <div className="wcc-center">
            <div className="wcc-badge-ic wcc-pop" data-kind="success">
              <HugeiconsIcon icon={Tick01Icon} size={30} strokeWidth={2} aria-hidden />
            </div>
            <p className="wcc-title">{state.alreadyPaid ? "This order is already paid" : "Payment complete"}</p>
            <p className="wcc-text">
              {amountLabel} USDT sent to {session.merchant.name.replace(/\.+$/, "")}.
            </p>
          </div>
          {r?.txHash ? (
            <div className="wcc-rows">
              <div className="wcc-row">
                <span className="wcc-row-k">Payment details</span>
                <a className="wcc-row-v wcc-mono" href={r.explorerUrl} target="_blank" rel="noreferrer">
                  View payment ↗
                </a>
              </div>
            </div>
          ) : null}
          {session.successUrl ? (
            <a className="wcc-btn" href={session.successUrl}>
              Return to store
            </a>
          ) : null}
        </section>
      );
    }

    case "connect":
    case "connecting": {
      const none = p.walletsSettled && p.wallets.length === 0;
      return (
        <section className="wcc-body" key="connect">
          <p className="wcc-title">Pay with your wallet</p>
          <p className="wcc-text">Connect a wallet that holds USDT on Whitechain.</p>
          <ErrorBanner message={state.error} onDismiss={p.onDismissError} />
          {none ? (
            <div className="wcc-alert" data-kind="info">
              <WalletIcon size={16} />
              <span>
                No wallet found.{" "}
                <a href={METAMASK_URL} target="_blank" rel="noreferrer">
                  Install MetaMask
                </a>{" "}
                and reload this page.
              </span>
            </div>
          ) : (
            <div className="wcc-wallets">
              {!p.walletsSettled && p.wallets.length === 0 ? (
                <div className="wcc-skel" style={{ height: 58, borderRadius: 14 }} />
              ) : (
                p.wallets.map((w) => {
                  const busy = state.phase === "connecting" && state.walletId === w.id;
                  return (
                    <button
                      key={w.id}
                      className="wcc-wallet"
                      disabled={state.phase === "connecting"}
                      onClick={() => p.onConnect(w)}
                    >
                      {w.icon ? (
                        <img src={w.icon} alt="" />
                      ) : (
                        <span className="wcc-wallet-icon">
                          <WalletIcon />
                        </span>
                      )}
                      <span className="wcc-wallet-name">{w.name}</span>
                      {busy ? (
                        <span className="wcc-spin" style={{ color: "var(--wcc-accent)" }} />
                      ) : (
                        <span className="wcc-wallet-hint">Connect ›</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
          {state.phase === "connecting" ? (
            <p className="wcc-text" style={{ margin: "12px 0 0", textAlign: "center" }}>
              Approve the connection in your wallet…
            </p>
          ) : null}
          {cancelLink ? <div style={{ marginTop: 8 }}>{cancelLink}</div> : null}
        </section>
      );
    }

    case "wrong_network":
    case "switching":
      return (
        <section className="wcc-body" key="network">
          <p className="wcc-title">Switch networks</p>
          <p className="wcc-text">
            Choose Whitechain in your wallet to continue.
          </p>
          <ErrorBanner message={state.error} onDismiss={p.onDismissError} />
          <AccountRow state={state} onDisconnect={p.onDisconnect} />
          <button className="wcc-btn" data-busy={state.phase === "switching"} disabled={state.phase === "switching"} onClick={p.onSwitch}>
            {state.phase === "switching" ? (
              <>
                <span className="wcc-spin" /> Confirm in your wallet…
              </>
            ) : (
              "Switch network"
            )}
          </button>
          {cancelLink}
        </section>
      );

    default:
      return <ReviewBody {...p} />;
  }
}

function AccountRow({ state, onDisconnect }: { state: State; onDisconnect?: () => void }) {
  if (!state.account) return null;
  return (
    <div className="wcc-rows">
      <div className="wcc-row">
        <span className="wcc-row-k">Pay from</span>
        <span className="wcc-row-v">
          <span className="wcc-mono">{short(state.account)}</span>
          {onDisconnect && isPrePay(state.phase) ? (
            <button className="wcc-link-btn" onClick={onDisconnect}>
              Change
            </button>
          ) : null}
        </span>
      </div>
    </div>
  );
}

function ReviewBody(p: ViewProps & { amountLabel: string }) {
  const { state, amountLabel } = p;
  const session = state.session as PublicCheckoutSession;
  const loaded = state.balance !== null;
  const lowBalance = insufficientBalance(state);
  const noGas = insufficientGas(state);
  const stepList = steps(state);

  let button: ReactNode;
  if (state.phase === "review") {
    button = (
      <button className="wcc-btn" disabled={!canPay(state)} onClick={p.onPay}>
        {!loaded ? (
          <>
            <span className="wcc-spin" /> Checking balance…
          </>
        ) : (
          `Pay ${amountLabel} USDT`
        )}
      </button>
    );
  } else {
    const label =
      state.phase === "approving"
        ? state.waiting === "wallet"
          ? "Allow this checkout to use your USDT…"
          : "Waiting for wallet approval…"
        : state.phase === "paying"
          ? "Confirm payment in your wallet…"
          : "Confirming payment…";
    button = (
      <button className="wcc-btn" data-busy="true" disabled>
        <span className="wcc-spin" /> {label}
      </button>
    );
  }

  return (
    <section className="wcc-body" key="review">
      <ErrorBanner message={state.error} onDismiss={p.onDismissError} />
      {state.phase === "review" && lowBalance ? (
        <div className="wcc-alert" data-kind="warn">
          <AlertIcon size={16} />
          <span>Not enough USDT.</span>
        </div>
      ) : state.phase === "review" && noGas ? (
        <div className="wcc-alert" data-kind="warn">
          <AlertIcon size={16} />
          <span>Not enough WBT.</span>
        </div>
      ) : null}
      <div className="wcc-rows">
        {state.account ? (
          <>
            <div className="wcc-row">
              <span className="wcc-row-k">Pay from</span>
              <span className="wcc-row-v">
                <span className="wcc-mono">{short(state.account)}</span>
                {state.phase === "review" ? (
                  <button className="wcc-link-btn" onClick={p.onDisconnect}>
                    Change
                  </button>
                ) : null}
              </span>
            </div>
            <div className="wcc-row">
              <span className="wcc-row-k">Your balance</span>
              <span className="wcc-row-v" data-bad={lowBalance}>
                {state.balance === null ? (
                  <span className="wcc-skel" style={{ width: 80, height: 14, display: "inline-block" }} />
                ) : (
                  `${formatAmount(state.balance, session.decimals)} USDT`
                )}
              </span>
            </div>
          </>
        ) : null}
        <div className="wcc-row">
          <span className="wcc-row-k">Total</span>
          <span className="wcc-row-v" style={{ fontWeight: 700 }}>
            {amountLabel} USDT
          </span>
        </div>
      </div>
      <ol className="wcc-steps" aria-label="Payment progress">
        {stepList.map((s, i) => (
          <li key={s.key} className="wcc-step" data-s={s.status}>
            <span className="wcc-step-ic">
              {s.status === "done" ? (
                <TickIcon />
              ) : s.status === "active" && state.phase !== "review" ? (
                <span className="wcc-spin" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
              ) : (
                i + 1
              )}
            </span>
            {s.label}
            {s.key === "approve" && s.status === "active" && state.approveTx ? (
              <a className="wcc-step-note" href={explorerTx(state.approveTx)} target="_blank" rel="noreferrer">
                View ↗
              </a>
            ) : null}
            {s.key === "confirm" && s.status === "active" && state.payTx ? (
              <a className="wcc-step-note" href={explorerTx(state.payTx)} target="_blank" rel="noreferrer">
                View payment ↗
              </a>
            ) : null}
          </li>
        ))}
      </ol>
      {button}
      {state.phase === "confirming" ? (
        <p className="wcc-text" style={{ margin: "10px 0 0", textAlign: "center", fontSize: 12 }}>
          This page will update once your payment is confirmed.
        </p>
      ) : null}
      {state.phase === "review" && p.canCancel ? (
        <button className="wcc-btn-ghost" onClick={p.onCancel}>
          Cancel and return to store
        </button>
      ) : null}
    </section>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading checkout">
      <div className="wcc-head">
        <div className="wcc-skel" style={{ width: 36, height: 36, borderRadius: 11 }} />
        <div style={{ flex: 1 }}>
          <div className="wcc-skel" style={{ width: 120, height: 14, marginBottom: 6 }} />
          <div className="wcc-skel" style={{ width: 80, height: 10 }} />
        </div>
      </div>
      <div className="wcc-amount">
        <div className="wcc-skel" style={{ width: 70, height: 10, marginBottom: 10 }} />
        <div className="wcc-skel" style={{ width: 180, height: 36 }} />
      </div>
      <div className="wcc-divider" />
      <div className="wcc-body">
        <div className="wcc-skel" style={{ height: 58, borderRadius: 14, marginBottom: 8 }} />
        <div className="wcc-skel" style={{ height: 52, borderRadius: 14 }} />
      </div>
    </div>
  );
}

// ---------- icons ----------
const LockIcon = () => <HugeiconsIcon icon={LockShape} size={12} strokeWidth={1.8} aria-hidden />;
const ClockIcon = ({ size = 13 }: { size?: number }) => <HugeiconsIcon icon={Clock01Icon} size={size} strokeWidth={1.8} aria-hidden />;
const AlertIcon = ({ size = 28 }: { size?: number }) => <HugeiconsIcon icon={AlertCircleIcon} size={size} strokeWidth={1.8} aria-hidden style={{ flex: "none", marginTop: size < 20 ? 1 : 0 }} />;
const WalletIcon = ({ size = 18 }: { size?: number }) => <HugeiconsIcon icon={Wallet01Icon} size={size} strokeWidth={1.8} aria-hidden style={{ flex: "none" }} />;
const TickIcon = () => <HugeiconsIcon icon={Tick01Icon} size={12} strokeWidth={2} aria-hidden />;
const UsdtIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="12" fill="#26A17B" />
    <path
      d="M13.3 10.4V8.7h3.9V6.2H6.8v2.5h3.9v1.7c-3.2.15-5.6.8-5.6 1.6s2.4 1.45 5.6 1.6v5.5h2.6v-5.5c3.2-.15 5.6-.8 5.6-1.6s-2.4-1.45-5.6-1.6zm0 2.6v0c-.1 0-.6.04-1.3.04-.6 0-1.1-.02-1.3-.04v0c-2.8-.12-4.9-.6-4.9-1.17s2.1-1.05 4.9-1.17v1.9c.2.02.7.05 1.3.05.7 0 1.2-.03 1.3-.05v-1.9c2.8.12 4.9.6 4.9 1.17S16.1 12.88 13.3 13z"
      fill="#fff"
    />
  </svg>
);
