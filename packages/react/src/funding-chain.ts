import { erc20Abi, USDT_ADDRESS, whitechainSepolia } from "@whitechain-commerce/core";
import { createPublicClient, createWalletClient, custom, encodeFunctionData, http, parseAbi, parseEther, type Address, type Hash } from "viem";
import { sepolia } from "viem/chains";
import { getL2TransactionHashes } from "viem/op-stack";
import type { Eip1193Provider } from "./wallets.ts";

export const SEPOLIA_ID = sepolia.id;
const ETH_ON_WHITECHAIN = "0x1c7E0793c69838D1da9D5b98B5893866B977bA67";
export const WBT_GAS_RESERVE = parseEther("0.01");
const WWBT = "0x4200000000000000000000000000000000000006";
const WETH = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
const BRIDGE = "0x0c50be539ab5d72d226038928f2eb25100899ded";
const PORTAL = "0xff9b597b0781457ae6aa7256ca5ed5839bf7d0c3";
const ROUTER = "0xe208cC685cD95D56E8ec6DEC9816476567fc6962";
const routerAbi = parseAbi([
  "function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountIn)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
  "function refundETH() payable",
]);
const wethAbi = parseAbi(["function deposit() payable"]);
const bridgeAbi = parseAbi(["function depositERC20(address localToken, address remoteToken, uint256 amount, uint32 minGasLimit, bytes extraData)"]);

const whitechain = createPublicClient({ chain: whitechainSepolia, transport: http() });
const ethereum = createPublicClient({ chain: sepolia, transport: http("https://ethereum-sepolia-rpc.publicnode.com") });

type Wallet = { provider: Eip1193Provider; account: Address; assertActive: () => Promise<void> };
export type Asset = "WBT" | "ETH";
export type Quote = { maximum: bigint; output: bigint; fee: number; asset: Asset; deadline: number };

export async function fundingBalances(account: Address) {
  const [usdt, eth, wbt] = await Promise.all([
    whitechain.readContract({ address: USDT_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [account] }),
    whitechain.readContract({ address: ETH_ON_WHITECHAIN, abi: erc20Abi, functionName: "balanceOf", args: [account] }),
    whitechain.getBalance({ address: account }),
  ]);
  return { usdt, eth, wbt };
}

async function confirm(client: Pick<typeof whitechain, "waitForTransactionReceipt">, hash: Hash) {
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (receipt.status !== "success") throw new Error("The transaction reverted.");
}

export async function swap({ provider, account, assertActive }: Wallet, quote: Quote) {
  const { asset, maximum, output, fee, deadline } = quote;
  const native = asset === "WBT";
  const value = native ? maximum : 0n;
  const tokenIn = native ? WWBT : ETH_ON_WHITECHAIN;
  const wallet = createWalletClient({ account, chain: whitechainSepolia, transport: custom(provider) });

  const ensureGas = async (fee: bigint) => {
    if (await whitechain.getBalance({ address: account }) < value + fee + WBT_GAS_RESERVE) {
      throw new Error("Leave at least 0.01 WBT after the swap fee for checkout.");
    }
  };
  await ensureGas(0n);
  if (!native) {
    if (await whitechain.readContract({ address: tokenIn, abi: erc20Abi, functionName: "balanceOf", args: [account] }) < maximum) {
      throw new Error("This wallet does not have enough bridged ETH.");
    }
    const allowance = await whitechain.readContract({
      address: tokenIn, abi: erc20Abi, functionName: "allowance", args: [account, ROUTER],
    });
    if (allowance < maximum) {
      const approval = await whitechain.simulateContract({
        account, address: tokenIn, abi: erc20Abi, functionName: "approve", args: [ROUTER, maximum],
      });
      await assertActive();
      await confirm(whitechain, await wallet.writeContract(approval.request));
    }
  }

  const data = [encodeFunctionData({
    abi: routerAbi,
    functionName: "exactOutputSingle",
    args: [{ tokenIn, tokenOut: USDT_ADDRESS, fee, recipient: account, amountOut: output, amountInMaximum: maximum, sqrtPriceLimitX96: 0n }],
  })];
  // SwapRouter02 wraps native WBT when it pays the pool. Return any unused input in the same transaction.
  if (native) data.push(encodeFunctionData({ abi: routerAbi, functionName: "refundETH" }));
  const call = { account, address: ROUTER, abi: routerAbi, functionName: "multicall", args: [BigInt(deadline), data], value } as const;
  const { request } = await whitechain.simulateContract(call);
  const [gas, price] = await Promise.all([whitechain.estimateContractGas(call), whitechain.getGasPrice()]);
  await ensureGas(gas * price);
  await assertActive();
  return wallet.writeContract(request);
}

export async function bridge({ provider, account, assertActive }: Wallet, amount: bigint) {
  const wallet = createWalletClient({ account, chain: sepolia, transport: custom(provider) });
  const [gas, wrapped] = await Promise.all([
    whitechain.getBalance({ address: account }),
    ethereum.readContract({ address: WETH, abi: erc20Abi, functionName: "balanceOf", args: [account] }),
  ]);
  if (gas < WBT_GAS_RESERVE) throw new Error("Get at least 0.01 WBT on Whitechain first to cover the swap and payment.");
  if (wrapped < amount) {
    const { request } = await ethereum.simulateContract({
      account, address: WETH, abi: wethAbi, functionName: "deposit", value: amount - wrapped,
    });
    await assertActive();
    await confirm(ethereum, await wallet.writeContract(request));
  }
  const allowance = await ethereum.readContract({
    address: WETH, abi: erc20Abi, functionName: "allowance", args: [account, BRIDGE],
  });
  if (allowance < amount) {
    const { request } = await ethereum.simulateContract({
      account, address: WETH, abi: erc20Abi, functionName: "approve", args: [BRIDGE, amount],
    });
    await assertActive();
    await confirm(ethereum, await wallet.writeContract(request));
  }
  const { request } = await ethereum.simulateContract({
    account, address: BRIDGE, abi: bridgeAbi, functionName: "depositERC20",
    args: [WETH, ETH_ON_WHITECHAIN, amount, 200_000, "0x"],
  });
  await assertActive();
  return wallet.writeContract(request);
}

export async function fundingStatus(kind: "bridge" | "swap", hash: Hash) {
  if (kind === "swap") {
    const receipt = await whitechain.getTransactionReceipt({ hash });
    return receipt.status;
  }
  const receipt = await ethereum.getTransactionReceipt({ hash });
  if (receipt.status === "reverted") return "reverted";
  const [depositHash] = getL2TransactionHashes({ logs: receipt.logs.filter((log) => log.address.toLowerCase() === PORTAL) });
  if (!depositHash) return "reverted";
  const deposit = await whitechain.getTransactionReceipt({ hash: depositHash });
  return deposit.status;
}
