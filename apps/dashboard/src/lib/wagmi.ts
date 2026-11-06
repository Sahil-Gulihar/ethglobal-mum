import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors/injected";
import { whitechainSepolia } from "@whitechain-commerce/core";

/**
 * Browser wallet config for the merchant dashboard (payout wallet connect + refunds).
 * Reads that need reliability (allowance, receipts) go through server actions using our RPC.
 */
export const wagmiConfig = createConfig({
  chains: [whitechainSepolia],
  connectors: [injected()],
  transports: { [whitechainSepolia.id]: http() },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
