/** Run: pnpm --filter @whitechain-commerce/react test   (tsx, node:test) */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { PublicCheckoutSession } from "@whitechain-commerce/core";
import {
  canPay,
  errorMessage,
  formatCountdown,
  hasErrorCode,
  initialState,
  isUserRejection,
  needsApproval,
  reducer,
  steps,
  type Action,
  type State,
} from "./state";

const session = (over: Partial<PublicCheckoutSession> = {}): PublicCheckoutSession => ({
  id: "cs_1",
  status: "open",
  merchant: { name: "Acme" },
  orderId: "order_1",
  amount: "49.99",
  amountUnits: "49990000",
  currency: "USDT",
  decimals: 6,
  chainId: 1874,
  routerAddress: "0x0000000000000000000000000000000000000001",
  tokenAddress: "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7",
  chainMerchantId: "0x01",
  chainOrderId: "0x02",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  successUrl: null,
  cancelUrl: null,
  payment: null,
  ...over,
});
const ACC = "0x00000000000000000000000000000000000000aa" as const;
const run = (...actions: Action[]): State => actions.reduce(reducer, initialState);

test("load: open -> connect, paid -> success, expired, processing -> confirming", () => {
  assert.equal(run({ type: "SESSION_LOADED", session: session() }).phase, "connect");
  const paid = run({ type: "SESSION_LOADED", session: session({ status: "paid" }) });
  assert.equal(paid.phase, "success");
  assert.equal(paid.alreadyPaid, true);
  assert.equal(run({ type: "SESSION_LOADED", session: session({ status: "expired" }) }).phase, "expired");
  assert.equal(run({ type: "SESSION_LOADED", session: session({ status: "processing" }) }).phase, "confirming");
});

test("connect on wrong chain, then switch", () => {
  let s = run(
    { type: "SESSION_LOADED", session: session() },
    { type: "CONNECT_START", walletId: "io.metamask" },
    { type: "CONNECTED", walletId: "io.metamask", account: ACC, chainId: 1 },
  );
  assert.equal(s.phase, "wrong_network");
  s = reducer(s, { type: "SWITCH_START" });
  assert.equal(s.phase, "switching");
  s = reducer(s, { type: "FAIL", message: "rejected" });
  assert.equal(s.phase, "wrong_network");
  s = reducer(s, { type: "CHAIN_CHANGED", chainId: 1874 });
  assert.equal(s.phase, "review");
  s = reducer(s, { type: "CHAIN_CHANGED", chainId: 5 });
  assert.equal(s.phase, "wrong_network");
});

const reviewing = (balance: bigint, allowance: bigint, gas = 10n ** 18n) =>
  run(
    { type: "SESSION_LOADED", session: session() },
    { type: "CONNECTED", walletId: "w", account: ACC, chainId: 1874 },
    { type: "BALANCES_LOADED", balance, allowance, gas },
  );

test("review gating: balance, gas, approval", () => {
  assert.equal(canPay(reviewing(49_990_000n, 0n)), true);
  assert.equal(needsApproval(reviewing(49_990_000n, 0n)), true);
  assert.equal(needsApproval(reviewing(49_990_000n, 49_990_000n)), false);
  assert.equal(canPay(reviewing(49_989_999n, 0n)), false);
  assert.equal(canPay(reviewing(100_000_000n, 0n, 0n)), false);
  // Can't start approving without enough balance.
  assert.equal(reducer(reviewing(1n, 0n), { type: "APPROVE_START" }).phase, "review");
});

test("approve -> pay -> confirming -> success; steps progress", () => {
  let s = reviewing(100_000_000n, 0n);
  assert.deepEqual(
    steps(s).map((x) => [x.key, x.status]),
    [["connect", "done"], ["approve", "todo"], ["pay", "todo"], ["confirm", "todo"]],
  );
  s = reducer(s, { type: "APPROVE_START" });
  assert.equal(s.phase, "approving");
  s = reducer(s, { type: "APPROVE_SENT", hash: "0xa1" });
  s = reducer(s, { type: "APPROVE_CONFIRMED", allowance: 49_990_000n });
  s = reducer(s, { type: "PAY_START" });
  assert.equal(s.phase, "paying");
  assert.deepEqual(
    steps(s).map((x) => x.status),
    ["done", "done", "active", "todo"],
  );
  // Wallet events during payment don't reset the flow.
  s = reducer(s, { type: "CHAIN_CHANGED", chainId: 1 });
  assert.equal(s.phase, "paying");
  s = reducer(s, { type: "CHAIN_CHANGED", chainId: 1874 });
  s = reducer(s, { type: "PAY_SENT", hash: "0xb2" });
  assert.equal(s.phase, "confirming");
  s = reducer(s, { type: "EXPIRE" });
  assert.equal(s.phase, "confirming", "expiry is ignored once the tx is sent");
  s = reducer(s, { type: "SESSION_POLLED", session: session({ status: "processing" }) });
  assert.equal(s.phase, "confirming");
  s = reducer(s, {
    type: "SESSION_POLLED",
    session: session({ status: "paid", payment: { id: "pay_1", txHash: "0xb2", explorerUrl: "x" } }),
  });
  assert.equal(s.phase, "success");
  assert.equal(s.alreadyPaid, false);
});

test("rejection in wallet returns to review with error", () => {
  let s = reducer(reviewing(100_000_000n, 100_000_000n), { type: "PAY_START" });
  s = reducer(s, { type: "FAIL", message: "rejected" });
  assert.equal(s.phase, "review");
  assert.equal(s.error, "rejected");
});

test("reverted pay tx returns to review", () => {
  let s = reducer(reviewing(100_000_000n, 100_000_000n), { type: "PAY_START" });
  s = reducer(s, { type: "PAY_SENT", hash: "0xb2" });
  s = reducer(s, { type: "PAY_REVERTED", message: "reverted" });
  assert.equal(s.phase, "review");
  assert.equal(s.payTx, null);
});

test("account change resets balances; disconnect -> connect; expiry before pay", () => {
  let s = reviewing(100_000_000n, 0n);
  s = reducer(s, { type: "ACCOUNTS_CHANGED", accounts: ["0x00000000000000000000000000000000000000bb"] });
  assert.equal(s.balance, null);
  assert.equal(s.phase, "review");
  s = reducer(s, { type: "ACCOUNTS_CHANGED", accounts: [] });
  assert.equal(s.phase, "connect");
  assert.equal(reducer(s, { type: "EXPIRE" }).phase, "expired");
});

test("error helpers", () => {
  const nested = { code: -32603, data: { originalError: { code: 4902 } } };
  assert.equal(hasErrorCode(nested, 4902), true);
  assert.equal(hasErrorCode({ cause: { cause: { code: 4001 } } }, 4001), true);
  assert.equal(isUserRejection({ name: "UserRejectedRequestError" }), true);
  assert.equal(isUserRejection(new Error("boom")), false);
  assert.match(errorMessage({ code: 4001 }), /rejected/);
  assert.equal(errorMessage({ shortMessage: "Execution reverted: already paid", message: "long\nstack" }), "Execution reverted: already paid");
  assert.equal(formatCountdown(61_500), "1:01");
  assert.equal(formatCountdown(0), null);
});

test("confirming: released processing -> open goes back to review with an error", () => {
  let s = reducer(reviewing(100_000_000n, 100_000_000n), { type: "PAY_START" });
  s = reducer(s, { type: "PAY_SENT", hash: "0xb2" });
  // Right after PAY_SENT the session is still open: must not reset.
  s = reducer(s, { type: "SESSION_POLLED", session: session({ status: "open" }) });
  assert.equal(s.phase, "confirming");
  s = reducer(s, { type: "SESSION_POLLED", session: session({ status: "processing" }) });
  s = reducer(s, { type: "SESSION_POLLED", session: session({ status: "open" }) });
  assert.equal(s.phase, "review");
  assert.match(s.error ?? "", /Check your wallet before trying again/);
  assert.equal(s.payTx, null);
});

test("confirming after reload: expired or released sessions don't spin forever", () => {
  let s = run({ type: "SESSION_LOADED", session: session({ status: "processing" }) });
  assert.equal(s.phase, "confirming");
  assert.equal(reducer(s, { type: "SESSION_POLLED", session: session({ status: "expired" }) }).phase, "expired");
  s = reducer(s, { type: "SESSION_POLLED", session: session({ status: "open" }) });
  assert.equal(s.phase, "connect", "no wallet connected after reload");
});
