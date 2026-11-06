import type { PublicCheckoutSession } from "@whitechain-commerce/core";

/** Pure checkout state machine. No React, no viem: unit-testable with tsx. */

export const WHITECHAIN_CHAIN_ID = 1874;

export type Phase =
  | "loading" // fetching the session
  | "load_error" // could not fetch the session (retryable)
  | "expired"
  | "connect" // choose a wallet
  | "connecting"
  | "wrong_network"
  | "switching"
  | "review" // balance/allowance shown, Pay button
  | "approving" // approve tx requested / mining
  | "paying" // pay tx requested
  | "confirming" // tx submitted, polling backend until paid
  | "success";

export interface State {
  phase: Phase;
  session: PublicCheckoutSession | null;
  account: `0x${string}` | null;
  chainId: number | null;
  walletId: string | null;
  balance: bigint | null;
  allowance: bigint | null;
  /** Native WBT balance, needed for gas. */
  gas: bigint | null;
  /** Hash of the in-flight approve tx (while approving). */
  approveTx: `0x${string}` | null;
  /** Hash of the pay tx once sent. */
  payTx: `0x${string}` | null;
  /** Sub-step of an approve/pay attempt, for the waiting UI. */
  waiting: "wallet" | "chain" | null;
  error: string | null;
  /** True when the session was already paid when we loaded it. */
  alreadyPaid: boolean;
}

export type Action =
  | { type: "SESSION_LOADED"; session: PublicCheckoutSession }
  | { type: "LOAD_FAILED"; message: string }
  | { type: "RETRY_LOAD" }
  | { type: "CONNECT_START"; walletId: string }
  | { type: "CONNECTED"; walletId: string; account: `0x${string}`; chainId: number }
  | { type: "ACCOUNTS_CHANGED"; accounts: readonly string[] }
  | { type: "CHAIN_CHANGED"; chainId: number }
  | { type: "DISCONNECT" }
  | { type: "SWITCH_START" }
  | { type: "BALANCES_LOADED"; balance: bigint; allowance: bigint; gas: bigint }
  | { type: "APPROVE_START" }
  | { type: "APPROVE_SENT"; hash: `0x${string}` }
  | { type: "APPROVE_CONFIRMED"; allowance: bigint }
  | { type: "PAY_START" }
  | { type: "PAY_SENT"; hash: `0x${string}` }
  | { type: "PAY_REVERTED"; message: string }
  | { type: "SESSION_POLLED"; session: PublicCheckoutSession }
  | { type: "EXPIRE" }
  | { type: "FAIL"; message: string }
  | { type: "CLEAR_ERROR" };

export const initialState: State = {
  phase: "loading",
  session: null,
  account: null,
  chainId: null,
  walletId: null,
  balance: null,
  allowance: null,
  gas: null,
  approveTx: null,
  payTx: null,
  waiting: null,
  error: null,
  alreadyPaid: false,
};

/** Phases where nothing irreversible has happened yet: expiry and wallet changes may reset them. */
const PRE_PAY: ReadonlySet<Phase> = new Set(["connect", "connecting", "wrong_network", "switching", "review"]);
export const isPrePay = (p: Phase) => PRE_PAY.has(p);

/** Where to go once we know the account and chain. */
function connectedPhase(chainId: number | null): Phase {
  return chainId === WHITECHAIN_CHAIN_ID ? "review" : "wrong_network";
}

export function amountUnits(s: State): bigint {
  return s.session ? BigInt(s.session.amountUnits) : 0n;
}
export function needsApproval(s: State): boolean {
  return s.allowance !== null && s.allowance < amountUnits(s);
}
export function insufficientBalance(s: State): boolean {
  return s.balance !== null && s.balance < amountUnits(s);
}
export function insufficientGas(s: State): boolean {
  return s.gas !== null && s.gas === 0n;
}
export function canPay(s: State): boolean {
  return (
    s.phase === "review" && s.balance !== null && s.allowance !== null && !insufficientBalance(s) && !insufficientGas(s)
  );
}

export const RELEASED_MESSAGE = "We couldn’t confirm your payment. Check your wallet before trying again.";

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SESSION_LOADED": {
      const session = action.session;
      if (session.status === "paid") return { ...state, session, phase: "success", alreadyPaid: true, error: null };
      if (session.status === "expired") return { ...state, session, phase: "expired", error: null };
      if (session.status === "processing") return { ...state, session, phase: "confirming", error: null };
      const phase: Phase = state.account ? connectedPhase(state.chainId) : "connect";
      return { ...state, session, phase, error: null };
    }
    case "LOAD_FAILED":
      return { ...state, phase: "load_error", error: action.message };
    case "RETRY_LOAD":
      return { ...state, phase: "loading", error: null };
    case "CONNECT_START":
      if (!isPrePay(state.phase)) return state;
      return { ...state, phase: "connecting", walletId: action.walletId, error: null };
    case "CONNECTED":
      if (!isPrePay(state.phase)) return state;
      return {
        ...state,
        walletId: action.walletId,
        account: action.account,
        chainId: action.chainId,
        balance: null,
        allowance: null,
        gas: null,
        phase: connectedPhase(action.chainId),
        error: null,
      };
    case "ACCOUNTS_CHANGED": {
      const next = (action.accounts[0] as `0x${string}` | undefined) ?? null;
      if (!next) {
        if (!isPrePay(state.phase)) return { ...state, account: null };
        return { ...state, account: null, balance: null, allowance: null, gas: null, phase: "connect" };
      }
      if (state.account && next.toLowerCase() === state.account.toLowerCase()) return state;
      if (!isPrePay(state.phase)) return { ...state, account: next };
      return {
        ...state,
        account: next,
        balance: null,
        allowance: null,
        gas: null,
        phase: state.phase === "connect" || state.phase === "connecting" ? state.phase : connectedPhase(state.chainId),
      };
    }
    case "CHAIN_CHANGED": {
      if (state.chainId === action.chainId) return state;
      if (!state.account || !isPrePay(state.phase) || state.phase === "connect" || state.phase === "connecting")
        return { ...state, chainId: action.chainId };
      return {
        ...state,
        chainId: action.chainId,
        balance: null,
        allowance: null,
        gas: null,
        phase: connectedPhase(action.chainId),
        error: null,
      };
    }
    case "DISCONNECT":
      if (!isPrePay(state.phase)) return state;
      return {
        ...state,
        account: null,
        walletId: null,
        balance: null,
        allowance: null,
        gas: null,
        phase: "connect",
        error: null,
      };
    case "SWITCH_START":
      if (state.phase !== "wrong_network") return state;
      return { ...state, phase: "switching", error: null };
    case "BALANCES_LOADED":
      // Ignore late reads while a payment attempt is running.
      if (!isPrePay(state.phase)) return state;
      return { ...state, balance: action.balance, allowance: action.allowance, gas: action.gas };
    case "APPROVE_START":
      if (!canPay(state)) return state;
      return { ...state, phase: "approving", waiting: "wallet", approveTx: null, error: null };
    case "APPROVE_SENT":
      return { ...state, approveTx: action.hash, waiting: "chain" };
    case "APPROVE_CONFIRMED":
      return { ...state, allowance: action.allowance, waiting: null };
    case "PAY_START":
      if (state.phase !== "review" && state.phase !== "approving") return state;
      return { ...state, phase: "paying", waiting: "wallet", error: null };
    case "PAY_SENT":
      return { ...state, phase: "confirming", payTx: action.hash, waiting: "chain" };
    case "PAY_REVERTED":
      if (state.phase !== "confirming") return state;
      return { ...state, phase: connectedPhase(state.chainId), payTx: null, waiting: null, error: action.message };
    case "SESSION_POLLED": {
      const session = action.session;
      if (session.status === "paid") return { ...state, session, phase: "success", waiting: null, error: null };
      if (session.status === "expired" && (isPrePay(state.phase) || state.phase === "confirming"))
        return { ...state, session, phase: "expired", waiting: null };
      // The worker released a `processing` session back to `open`: the hinted tx didn't pay it.
      // Only on that transition: right after PAY_SENT the session is still `open` until /submit lands.
      if (state.phase === "confirming" && state.session?.status === "processing" && session.status === "open") {
        return {
          ...state,
          session,
          phase: state.account ? connectedPhase(state.chainId) : "connect",
          payTx: null,
          waiting: null,
          error: RELEASED_MESSAGE,
        };
      }
      return { ...state, session };
    }
    case "EXPIRE":
      if (!isPrePay(state.phase)) return state;
      return { ...state, phase: "expired" };
    case "FAIL": {
      // Recover to the nearest sensible phase so the user can retry.
      let phase: Phase = state.phase;
      if (state.phase === "connecting") phase = "connect";
      else if (state.phase === "switching") phase = "wrong_network";
      else if (state.phase === "approving" || state.phase === "paying")
        phase = state.account ? connectedPhase(state.chainId) : "connect";
      return { ...state, phase, waiting: null, error: action.message };
    }
    case "CLEAR_ERROR":
      return { ...state, error: null };
  }
}

/** Steps shown in the progress list. */
export type StepStatus = "done" | "active" | "todo";
export interface Step {
  key: "connect" | "approve" | "pay" | "confirm";
  label: string;
  status: StepStatus;
}

export function steps(s: State): Step[] {
  const order: Phase[] = [
    "connect",
    "connecting",
    "wrong_network",
    "switching",
    "review",
    "approving",
    "paying",
    "confirming",
    "success",
  ];
  const idx = order.indexOf(s.phase);
  const at = (p: Phase) => order.indexOf(p);
  const list: Step[] = [];
  const connected = idx >= at("review");
  list.push({
    key: "connect",
    label: s.phase === "wrong_network" || s.phase === "switching" ? "Switch to Whitechain" : "Connect wallet",
    status: connected ? "done" : "active",
  });
  // Show the approve step when it is (or was) needed in this attempt.
  const showApprove = needsApproval(s) || s.phase === "approving" || s.approveTx !== null;
  if (showApprove)
    list.push({
      key: "approve",
      label: "Allow USDT payment",
      status: s.phase === "approving" ? "active" : idx > at("approving") ? "done" : "todo",
    });
  list.push({
    key: "pay",
    label: "Confirm payment",
    status: s.phase === "paying" ? "active" : idx > at("paying") ? "done" : "todo",
  });
  list.push({
    key: "confirm",
    label: "Settlement on Whitechain",
    status: s.phase === "confirming" ? "active" : s.phase === "success" ? "done" : "todo",
  });
  return list;
}

/** "29:41" style countdown; null when expired. */
export function formatCountdown(msLeft: number): string | null {
  if (msLeft <= 0) return null;
  const total = Math.floor(msLeft / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Walks viem / EIP-1193 errors (nested via `cause` and `data.originalError`) looking for `code`. */
export function hasErrorCode(err: unknown, code: number): boolean {
  const queue: unknown[] = [err];
  for (let i = 0; i < 16 && queue.length; i++) {
    const e = queue.shift();
    if (!e || typeof e !== "object") continue;
    const o = e as { code?: unknown; data?: { originalError?: unknown }; cause?: unknown };
    if (o.code === code) return true;
    if (o.data && typeof o.data === "object") queue.push(o.data.originalError);
    queue.push(o.cause);
  }
  return false;
}

export function isUserRejection(err: unknown): boolean {
  if (hasErrorCode(err, 4001)) return true;
  let e: unknown = err;
  for (let i = 0; i < 8 && e && typeof e === "object"; i++) {
    if ((e as { name?: string }).name === "UserRejectedRequestError") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

/** Short, human error message from a viem/wallet error. */
export function errorMessage(err: unknown): string {
  if (isUserRejection(err)) return "Request rejected in your wallet. You can try again.";
  if (err && typeof err === "object") {
    const o = err as { shortMessage?: string; message?: string };
    const msg = o.shortMessage || o.message;
    if (msg) return msg.split("\n")[0]!.slice(0, 220);
  }
  return String(err ?? "Unknown error");
}
