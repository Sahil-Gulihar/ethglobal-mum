/**
 * Plays the customer on Whitechain Sepolia: opens a payment link or checkout URL, pays it from the
 * test wallet exactly like the checkout widget does (approve if needed, PaymentRouter.pay, then
 * report the tx hash), and prints the result. Real testnet USDT moves.
 *
 *   cd apps/dashboard && pnpm exec tsx --env-file=../../.env scripts/customer-pay.ts <pay-link-or-checkout-url> [--no-report]
 *
 * --no-report skips step 3, like a customer who closes the tab right after paying. The payment must
 * then be found onchain (worker, cron tick, or the wait_for_payment agent tool).
 *
 * Needs TEST_WALLET_PRIVATE_KEY (with testnet USDT and WBT for gas) and WHITECHAIN_RPC_URL.
 */
import { createPublicClient, createWalletClient, http, formatUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { erc20Abi, paymentRouterAbi, whitechainSepolia, type PublicCheckoutSession } from "@whitechain-commerce/core";

async function main() {
  const target = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const report = !process.argv.includes("--no-report");
  if (!target) throw new Error("Usage: customer-pay.ts <pay-link-or-checkout-url>");
  const key = process.env.TEST_WALLET_PRIVATE_KEY as Hex | undefined;
  if (!key) throw new Error("TEST_WALLET_PRIVATE_KEY is not set");

  // 1. Open the link like a browser. /pay/pl_... redirects to a fresh /checkout/cs_...
  let checkoutUrl = target;
  if (!/\/checkout\/cs_/.test(target)) {
    const res = await fetch(target, { redirect: "manual" });
    const loc = res.headers.get("location");
    if (!loc) throw new Error(`Expected a redirect to a checkout from ${target}, got HTTP ${res.status}`);
    checkoutUrl = new URL(loc, target).toString();
  }
  const u = new URL(checkoutUrl);
  const sessionId = u.pathname.split("/").pop()!;
  const api = `${u.origin}/api/v1/checkout_sessions/${sessionId}`;
  const s = (await (await fetch(api)).json()) as PublicCheckoutSession;
  if (s.status !== "open") throw new Error(`Session ${sessionId} is ${s.status}, not open`);
  console.log(`checkout   ${checkoutUrl}\nmerchant   ${s.merchant.name}\namount     ${s.amount} ${s.currency}`);

  // 2. Pay onchain from the customer's wallet.
  const account = privateKeyToAccount(key);
  const transport = http(process.env.WHITECHAIN_RPC_URL);
  const pub = createPublicClient({ chain: whitechainSepolia, transport });
  const wallet = createWalletClient({ account, chain: whitechainSepolia, transport });
  const amount = BigInt(s.amountUnits);
  const token = s.tokenAddress as Hex;
  const router = s.routerAddress as Hex;

  const balance = await pub.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
  if (balance < amount) throw new Error(`Customer has ${formatUnits(balance, s.decimals)} USDT, needs ${s.amount}`);
  const allowance = await pub.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [account.address, router] });
  if (allowance < amount) {
    const approve = await wallet.writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [router, amount] });
    await pub.waitForTransactionReceipt({ hash: approve });
    console.log(`approved   ${approve}`);
  }
  const hash = await wallet.writeContract({
    address: router,
    abi: paymentRouterAbi,
    functionName: "pay",
    args: [s.chainMerchantId as Hex, s.chainOrderId as Hex, amount],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`pay() reverted: ${hash}`);
  console.log(`paid       ${hash} (block ${receipt.blockNumber})\npayer      ${account.address}`);

  // 3. Report the hash like the widget does. This is only a hint; the server verifies onchain.
  if (!report) return console.log("reported   no (--no-report)");
  const submit = await fetch(`${api}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHash: hash }),
  });
  console.log(`reported   HTTP ${submit.status} ${await submit.text()}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
