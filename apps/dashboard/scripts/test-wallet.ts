/**
 * A local test wallet for driving the real checkout widget and dashboard in an automated browser,
 * on Whitechain Sepolia, without MetaMask. Testnet only.
 *
 * Two parts:
 *  1. This server signs and sends transactions with a test key and proxies every other JSON-RPC call
 *     to WHITECHAIN_RPC_URL.
 *  2. GET /inject.js returns a script that, run before the page's own scripts (for example as a
 *     DevTools init script), announces an EIP-6963 wallet named "Test Wallet" and sets
 *     window.ethereum. The page talks to it like any browser wallet.
 *
 *   cd apps/dashboard && pnpm exec tsx --env-file=../../.env scripts/test-wallet.ts
 *
 * Keys: ?as=customer uses CUSTOMER_PRIVATE_KEY (falls back to DEPLOYER_PRIVATE_KEY);
 *       ?as=merchant uses PAYOUT_PRIVATE_KEY (falls back to TEST_WALLET_PRIVATE_KEY).
 * Listens on 127.0.0.1 only. Never point it at mainnet keys.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { whitechainSepolia } from "@whitechain-commerce/core";

const PORT = Number(process.env.TEST_WALLET_PORT || 8787);
const rpcUrl = process.env.WHITECHAIN_RPC_URL!;
const keys = {
  customer: (process.env.CUSTOMER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY) as Hex,
  merchant: (process.env.PAYOUT_PRIVATE_KEY || process.env.TEST_WALLET_PRIVATE_KEY) as Hex,
};
const transport = http(rpcUrl);
const pub = createPublicClient({ chain: whitechainSepolia, transport });
const wallets = Object.fromEntries(
  Object.entries(keys).map(([role, key]) => {
    const account = privateKeyToAccount(key);
    return [role, { account, client: createWalletClient({ account, chain: whitechainSepolia, transport }) }];
  }),
) as Record<keyof typeof keys, { account: ReturnType<typeof privateKeyToAccount>; client: ReturnType<typeof createWalletClient> }>;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Private-Network": "true",
};

const injectScript = (role: string, address: string) => `(() => {
  const SERVER = "http://127.0.0.1:${PORT}/rpc?as=${role}";
  const ADDRESS = "${address}";
  const CHAIN = "0x${whitechainSepolia.id.toString(16)}";
  const listeners = {};
  let id = 0;
  const provider = {
    isTestWallet: true,
    async request({ method, params }) {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [ADDRESS];
      if (method === "eth_chainId") return CHAIN;
      if (method === "net_version") return String(parseInt(CHAIN, 16));
      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
      if (method === "wallet_requestPermissions" || method === "wallet_getPermissions") return [{ parentCapability: "eth_accounts" }];
      const res = await fetch(SERVER, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params: params ?? [] }) });
      const json = await res.json();
      if (json.error) { const e = new Error(json.error.message); e.code = json.error.code; throw e; }
      return json.result;
    },
    on(ev, fn) { (listeners[ev] ||= []).push(fn); return provider; },
    removeListener(ev, fn) { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); return provider; },
  };
  const info = { uuid: "4f0c1e1a-test-wallet-${role}", name: "Test Wallet", icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAzMiAzMic+PHJlY3Qgd2lkdGg9JzMyJyBoZWlnaHQ9JzMyJyByeD0nOCcgZmlsbD0nIzBlYTVlOScvPjwvc3ZnPg==", rdns: "dev.whitechain.testwallet" };
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }));
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
  window.ethereum = provider;
})();`;

async function body(req: IncomingMessage): Promise<string> {
  let s = "";
  for await (const chunk of req) s += chunk;
  return s;
}

async function handleRpc(role: keyof typeof keys, msg: { id: unknown; method: string; params: unknown[] }) {
  const w = wallets[role];
  if (msg.method === "eth_sendTransaction") {
    const tx = msg.params[0] as { to: Hex; data?: Hex; value?: Hex; gas?: Hex };
    const hash = await w.client.sendTransaction({
      account: w.account,
      chain: whitechainSepolia,
      to: tx.to,
      data: tx.data,
      value: tx.value ? BigInt(tx.value) : undefined,
      gas: tx.gas ? BigInt(tx.gas) : undefined,
    });
    console.log(`[test-wallet] ${role} sent ${hash}`);
    return hash;
  }
  return pub.request({ method: msg.method as never, params: msg.params as never });
}

createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const role = (url.searchParams.get("as") === "merchant" ? "merchant" : "customer") as keyof typeof keys;
  if (req.method === "OPTIONS") return res.writeHead(204, CORS).end();
  if (url.pathname === "/inject.js") {
    res.writeHead(200, { ...CORS, "Content-Type": "text/javascript" });
    return res.end(injectScript(role, wallets[role].account.address));
  }
  if (url.pathname === "/rpc" && req.method === "POST") {
    const msg = JSON.parse(await body(req));
    try {
      const result = await handleRpc(role, msg);
      res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
      return res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }, (_k, v) => (typeof v === "bigint" ? `0x${v.toString(16)}` : v)));
    } catch (e) {
      const err = e as { code?: number; shortMessage?: string; message?: string };
      console.log(`[test-wallet] ${role} ${msg.method} failed: ${err.shortMessage ?? err.message}`);
      res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
      return res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: err.code ?? -32000, message: err.shortMessage ?? err.message ?? "error" } }));
    }
  }
  res.writeHead(404, CORS).end();
}).listen(PORT, "127.0.0.1", () => {
  for (const [role, w] of Object.entries(wallets)) console.log(`[test-wallet] ${role}: ${w.account.address}`);
  console.log(`[test-wallet] inject: http://127.0.0.1:${PORT}/inject.js?as=customer|merchant`);
});
