import { defineChain, type Chain } from "viem";

export const WHITECHAIN_SEPOLIA_ID = 1874 as const;

/** Official Whitechain Sepolia USDT. Verified onchain: symbol USDT, decimals() = 6. */
export const USDT_ADDRESS = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7" as const;
/** Read decimals() onchain in server code; this constant is only a display fallback. */
export const USDT_DECIMALS_FALLBACK = 6;

export const EXPLORER_URL = "https://explorer.testnet.whitechain.io";

/**
 * Public RPC used by browsers (wallet_addEthereumChain). Servers use WHITECHAIN_RPC_URL from env.
 * Official keyless public RPC for chain 1874 (docs.whitechain.io/learn/get-started/connect-wallet), eth_chainId 0x752,
 * CORS allow-origin *. NOTE: https://rpc-testnet.whitechain.io (hyphen) returns chainId 2625, a different network.
 */
export const PUBLIC_RPC_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_WHITECHAIN_RPC_URL) || "https://rpc.testnet.whitechain.io";

export const whitechainSepolia: Chain & { id: typeof WHITECHAIN_SEPOLIA_ID } = defineChain({
  id: WHITECHAIN_SEPOLIA_ID,
  name: "Whitechain Sepolia",
  nativeCurrency: { name: "WhiteBIT Coin", symbol: "WBT", decimals: 18 },
  rpcUrls: { default: { http: [PUBLIC_RPC_URL] } },
  blockExplorers: { default: { name: "Whitechain Explorer", url: EXPLORER_URL } },
  testnet: true,
});

export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const explorerAddress = (addr: string) => `${EXPLORER_URL}/address/${addr}`;
