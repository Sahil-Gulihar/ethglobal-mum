"use client";

import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from "wagmi";
import { whitechainSepolia } from "@whitechain-commerce/core";

/** Thin wrapper over wagmi for the injected wallet on Whitechain Sepolia. */
export function useWallet() {
  const conn = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();

  const injectedConnector = connectors[0];

  return {
    address: conn.address,
    chainId: conn.chainId,
    isConnected: conn.status === "connected",
    isConnecting: conn.status === "connecting" || conn.status === "reconnecting" || connect.isPending,
    onRightChain: conn.chainId === whitechainSepolia.id,
    connectError: connect.error,
    connect: async () => {
      if (!injectedConnector) throw new Error("No browser wallet found. Install MetaMask or Rabby.");
      await connect.mutateAsync({ connector: injectedConnector, chainId: whitechainSepolia.id });
    },
    disconnect: () => disconnect.mutate(),
    switchToWhitechain: () => switchChain.mutateAsync({ chainId: whitechainSepolia.id }),
    isSwitching: switchChain.isPending,
  };
}

export function walletErrorMessage(e: unknown): string {
  let cur: unknown = e;
  for (let i = 0; i < 5 && cur && typeof cur === "object"; i++) {
    const o = cur as { name?: string; code?: number; cause?: unknown };
    if (o.name === "UserRejectedRequestError" || o.code === 4001) return "You rejected the request in your wallet.";
    cur = o.cause;
  }
  if (e && typeof e === "object") {
    const o = e as { shortMessage?: string; message?: string };
    if (o.shortMessage) return o.shortMessage;
    if (o.message) return o.message.split("\n")[0].slice(0, 240);
  }
  return "Wallet request failed.";
}
