"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PRODUCTS, type Product } from "@/lib/catalog";

export interface CartLine {
  product: Product;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  count: number;
  subtotalCents: number;
  open: boolean;
  /** False until the saved cart has been read from localStorage (avoids a flash of "0"). */
  hydrated: boolean;
  setOpen: (open: boolean) => void;
  add: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartState | null>(null);
const STORAGE_KEY = "chai-co-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
      if (saved) setQuantities(JSON.parse(saved));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(quantities));
  }, [quantities, hydrated]);

  const add = useCallback((productId: string) => {
    // The add button confirms inline and the header count updates; the drawer stays closed.
    setQuantities((q) => ({ ...q, [productId]: Math.min((q[productId] ?? 0) + 1, 20) }));
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setQuantities((q) => {
      const next = { ...q };
      if (quantity <= 0) delete next[productId];
      else next[productId] = Math.min(quantity, 20);
      return next;
    });
  }, []);

  const clear = useCallback(() => setQuantities({}), []);

  const value = useMemo<CartState>(() => {
    const lines = PRODUCTS.filter((p) => quantities[p.id]).map((product) => ({
      product,
      quantity: quantities[product.id],
    }));
    return {
      lines,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      subtotalCents: lines.reduce((n, l) => n + l.quantity * l.product.priceCents, 0),
      open,
      hydrated,
      setOpen,
      add,
      setQuantity,
      clear,
    };
  }, [quantities, open, hydrated, add, setQuantity, clear]);

  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
