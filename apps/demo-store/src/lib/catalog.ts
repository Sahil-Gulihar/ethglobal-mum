export interface Product {
  id: string;
  name: string;
  tagline: string;
  description: string;
  /** Price in USDT cents (2 dp). Prices are only ever read server-side for totals. */
  priceCents: number;
  art: "tin" | "cup" | "gift" | "sachet";
  tone: string; // card background
  badge?: string;
}

export const PRODUCTS: Product[] = [
  {
    id: "masala-chai-tin",
    name: "Masala Chai Tin",
    tagline: "Assam CTC, cardamom, ginger, clove",
    description: "Our house blend, hand-pounded spices in a 100 g keepsake tin. About 40 cups.",
    priceCents: 5,
    art: "tin",
    tone: "#F6E3C8",
    badge: "Bestseller",
  },
  {
    id: "kulhad-cup",
    name: "Ceramic Kulhad Cup",
    tagline: "Glazed stoneware, 180 ml",
    description: "Inspired by the clay cups of railway platforms, made to last a lifetime.",
    priceCents: 10,
    art: "cup",
    tone: "#EFD9CF",
  },
  {
    id: "gift-box",
    name: "Chai Ritual Gift Box",
    tagline: "Tin, two cups and a brass strainer",
    description: "Everything for a slow Sunday chai, wrapped in hand-block-printed cloth.",
    priceCents: 25,
    art: "gift",
    tone: "#DCE4D3",
    badge: "Gift",
  },
  {
    id: "tasting-sachet",
    name: "Tasting Sachet",
    tagline: "Single-brew sample",
    description: "Not sure yet? One perfect cup's worth of our masala blend.",
    priceCents: 1,
    art: "sachet",
    tone: "#F3E7D3",
  },
];

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function formatUsdt(cents: number): string {
  return (cents / 100).toFixed(2);
}
