import { defineChain } from "viem";

export const WHITECHAIN_SEPOLIA_ID = 1874 as const;

/** Official Whitechain Sepolia USDT. Verified onchain: symbol USDT, decimals() = 6. */
export const USDT_ADDRESS = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7" as const;
/** Read decimals() onchain in server code; this constant is only a display fallback. */
export const USDT_DECIMALS_FALLBACK = 6;

export const EXPLORER_URL = "https://explorer.testnet.whitechain.io";

/**
 * Public RPC used by browsers (wallet_addEthereumChain). Servers use WHITECHAIN_RPC_URL from env.
 * TODO(contracts agent): confirm the official public RPC for chain 1874 from docs.whitechain.io.
 * NOTE: https://rpc-testnet.whitechain.io returns chainId 2625 (a different network), do NOT use it.
 */
export const PUBLIC_RPC_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_WHITECHAIN_RPC_URL) || "https://rpc-sepolia.whitechain.io";

export const whitechainSepolia = defineChain({
  id: WHITECHAIN_SEPOLIA_ID,
  name: "Whitechain Sepolia",
  nativeCurrency: { name: "WhiteBIT Coin", symbol: "WBT", decimals: 18 },
  rpcUrls: { default: { http: [PUBLIC_RPC_URL] } },
  blockExplorers: { default: { name: "Whitechain Explorer", url: EXPLORER_URL } },
  testnet: true,
});

export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const explorerAddress = (addr: string) => `${EXPLORER_URL}/address/${addr}`;
