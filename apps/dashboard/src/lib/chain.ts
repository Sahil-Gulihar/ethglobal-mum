import "server-only";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { whitechainSepolia, getRouterAddress, paymentRouterAbi, erc20Abi, USDT_ADDRESS } from "@whitechain-commerce/core";
import { env } from "./env";

export const publicClient = () => createPublicClient({ chain: whitechainSepolia, transport: http(env.rpcUrl()) });

export const backendWallet = () =>
  createWalletClient({ chain: whitechainSepolia, transport: http(env.rpcUrl()), account: privateKeyToAccount(env.deployerKey()) });

let decimalsCache: number | null = null;
/** Reads USDT decimals() onchain once per process. Never assume. */
export async function usdtDecimals(): Promise<number> {
  if (decimalsCache !== null) return decimalsCache;
  decimalsCache = Number(await publicClient().readContract({ address: USDT_ADDRESS, abi: erc20Abi, functionName: "decimals" }));
  return decimalsCache;
}

/** Backend signer (router owner) registers or updates a merchant's payout address onchain. */
export async function registerMerchantOnchain(chainMerchantId: `0x${string}`, payout: `0x${string}`) {
  const wallet = backendWallet();
  const hash = await wallet.writeContract({
    address: getRouterAddress(),
    abi: paymentRouterAbi,
    functionName: "registerMerchant",
    args: [chainMerchantId, payout],
  });
  const receipt = await publicClient().waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`registerMerchant reverted: ${hash}`);
  return hash;
}
