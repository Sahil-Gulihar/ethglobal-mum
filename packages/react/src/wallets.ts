/** EIP-6963 multi-wallet discovery with a window.ethereum fallback. Browser only. */

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  on?(event: string, listener: (...args: any[]) => void): void;
  removeListener?(event: string, listener: (...args: any[]) => void): void;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
}

export interface DetectedWallet {
  id: string; // rdns, uuid or "injected"
  name: string;
  icon: string | null; // data URI
  provider: Eip1193Provider;
}

interface Eip6963Detail {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Eip1193Provider;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

/**
 * Subscribes to wallet announcements. Calls `onChange` with the current list whenever a wallet
 * announces itself. After `fallbackMs` with no announcement, falls back to window.ethereum.
 * Returns an unsubscribe function.
 */
export function watchWallets(
  onChange: (wallets: DetectedWallet[], settled: boolean) => void,
  fallbackMs = 400,
): () => void {
  if (typeof window === "undefined") return () => {};
  const byId = new Map<string, DetectedWallet>();
  let settled = false;
  const emit = () => onChange([...byId.values()], settled);

  const onAnnounce = (event: Event) => {
    const detail = (event as CustomEvent<Eip6963Detail>).detail;
    if (!detail?.info || !detail.provider) return;
    const id = detail.info.rdns || detail.info.uuid;
    if (byId.has(id)) return;
    byId.set(id, { id, name: detail.info.name, icon: detail.info.icon || null, provider: detail.provider });
    byId.delete("injected");
    emit();
  };
  window.addEventListener("eip6963:announceProvider", onAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  const timer = window.setTimeout(() => {
    settled = true;
    if (byId.size === 0 && window.ethereum) {
      const eth = window.ethereum;
      const name = eth.isRabby
        ? "Rabby"
        : eth.isCoinbaseWallet
          ? "Coinbase Wallet"
          : eth.isMetaMask
            ? "MetaMask"
            : "Browser wallet";
      byId.set("injected", { id: "injected", name, icon: null, provider: eth });
    }
    emit();
  }, fallbackMs);

  return () => {
    window.removeEventListener("eip6963:announceProvider", onAnnounce);
    window.clearTimeout(timer);
  };
}

const LAST_WALLET_KEY = "wc-commerce:last-wallet";
export function rememberWallet(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST_WALLET_KEY, id);
    else localStorage.removeItem(LAST_WALLET_KEY);
  } catch {
    /* storage unavailable */
  }
}
export function lastWallet(): string | null {
  try {
    return localStorage.getItem(LAST_WALLET_KEY);
  } catch {
    return null;
  }
}
