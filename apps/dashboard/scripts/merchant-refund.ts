/**
 * Plays the merchant signing a refund on Whitechain Sepolia, exactly like the dashboard's refund
 * panel: the payout wallet approves the router for the amount, then calls
 * PaymentRouter.refund(chainPaymentId, amount). Real testnet USDT moves back to the customer.
 *
 * Create the pending refund first (dashboard, API, or the create_refund agent tool) so the indexer
 * can match the onchain event to it and send refund.succeeded.
 *
 *   cd apps/dashboard && pnpm exec tsx --env-file=../../.env scripts/merchant-refund.ts <chainPaymentId> <amount>
 *
 * Signs with PAYOUT_PRIVATE_KEY (falls back to TEST_WALLET_PRIVATE_KEY); it must be the merchant's
 * registered payout wallet, or the router reverts with NotPayout.
 */
import { createPublicClient, createWalletClient, http, parseUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { erc20Abi, getRouterAddress, paymentRouterAbi, USDT_ADDRESS, whitechainSepolia } from "@whitechain-commerce/core";

async function main() {
  const [chainPaymentId, amount] = process.argv.slice(2);
  if (!/^0x[0-9a-fA-F]{64}$/.test(chainPaymentId ?? "") || !/^\d+(\.\d+)?$/.test(amount ?? "")) {
    throw new Error("Usage: merchant-refund.ts <chainPaymentId 0x...> <amount, e.g. 0.50>");
  }
  const key = (process.env.PAYOUT_PRIVATE_KEY || process.env.TEST_WALLET_PRIVATE_KEY) as Hex | undefined;
  if (!key) throw new Error("Set PAYOUT_PRIVATE_KEY (the merchant's payout wallet key)");

  const account = privateKeyToAccount(key);
  const transport = http(process.env.WHITECHAIN_RPC_URL);
  const pub = createPublicClient({ chain: whitechainSepolia, transport });
  const wallet = createWalletClient({ account, chain: whitechainSepolia, transport });
  const router = getRouterAddress();
  const units = parseUnits(amount, 6);

  const allowance = await pub.readContract({ address: USDT_ADDRESS, abi: erc20Abi, functionName: "allowance", args: [account.address, router] });
  if (allowance < units) {
    const approve = await wallet.writeContract({ address: USDT_ADDRESS, abi: erc20Abi, functionName: "approve", args: [router, units] });
    await pub.waitForTransactionReceipt({ hash: approve });
    console.log(`approved   ${approve}`);
  }
  const hash = await wallet.writeContract({
    address: router,
    abi: paymentRouterAbi,
    functionName: "refund",
    args: [chainPaymentId as Hex, units],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`refund() reverted: ${hash}`);
  console.log(`refunded   ${amount} USDT in ${hash} (block ${receipt.blockNumber})\nsigned by  ${account.address}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
