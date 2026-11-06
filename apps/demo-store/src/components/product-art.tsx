import type { Product } from "@/lib/catalog";

/** Original flat illustrations, one per product. */
export function ProductArt({ art, className = "" }: { art: Product["art"]; className?: string }) {
  const common = { viewBox: "0 0 200 200", className, "aria-hidden": true } as const;
  switch (art) {
    case "tin":
      return (
        <svg {...common}>
          <ellipse cx="100" cy="172" rx="58" ry="8" fill="#2a1a12" opacity="0.08" />
          <rect x="52" y="48" width="96" height="122" rx="10" fill="#b5482a" />
          <rect x="48" y="40" width="104" height="22" rx="7" fill="#963a21" />
          <rect x="52" y="88" width="96" height="50" fill="#fbf6ee" />
          <path d="M52 88h96M52 138h96" stroke="#e5a13a" strokeWidth="4" />
          <text x="100" y="111" textAnchor="middle" fontFamily="Georgia, serif" fontSize="16" fontWeight="700" fill="#2a1a12">
            MASALA
          </text>
          <text x="100" y="129" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fontStyle="italic" fill="#b5482a">
            chai · 100g
          </text>
          <g fill="#e5a13a">
            <circle cx="70" cy="156" r="3" />
            <circle cx="85" cy="156" r="3" />
            <circle cx="100" cy="156" r="3" />
            <circle cx="115" cy="156" r="3" />
            <circle cx="130" cy="156" r="3" />
          </g>
          <path d="M66 68c6 6 14 6 20 0s14-6 20 0 14 6 20 0" fill="none" stroke="#e5a13a" strokeWidth="3" />
        </svg>
      );
    case "cup":
      return (
        <svg {...common}>
          <ellipse cx="100" cy="166" rx="56" ry="8" fill="#2a1a12" opacity="0.08" />
          <g className="steam" fill="none" stroke="#b5482a" strokeWidth="4" strokeLinecap="round" opacity="0.5">
            <path d="M80 52c-6-8 6-12 0-22" />
            <path d="M100 52c-6-8 6-12 0-22" />
            <path d="M120 52c-6-8 6-12 0-22" />
          </g>
          <path d="M52 66h96l-10 86a14 14 0 0 1-14 12H76a14 14 0 0 1-14-12L52 66Z" fill="#c8693f" />
          <ellipse cx="100" cy="66" rx="48" ry="10" fill="#963a21" />
          <ellipse cx="100" cy="67" rx="42" ry="7" fill="#d9a066" />
          <path d="M58 92h84" stroke="#fbf6ee" strokeWidth="5" opacity="0.6" />
          <path d="M61 104h78" stroke="#e5a13a" strokeWidth="3" opacity="0.8" />
        </svg>
      );
    case "gift":
      return (
        <svg {...common}>
          <ellipse cx="100" cy="172" rx="66" ry="8" fill="#2a1a12" opacity="0.08" />
          <rect x="40" y="82" width="120" height="88" rx="8" fill="#5f7a4e" />
          <rect x="34" y="66" width="132" height="28" rx="7" fill="#4c6440" />
          <rect x="92" y="66" width="16" height="104" fill="#e5a13a" />
          <path d="M100 66c-10-26-40-26-34-8 3 9 20 8 34 8Zm0 0c10-26 40-26 34-8-3 9-20 8-34 8Z" fill="#b5482a" />
          <g fill="#fbf6ee" opacity="0.35">
            <circle cx="60" cy="118" r="5" />
            <circle cx="140" cy="118" r="5" />
            <circle cx="60" cy="148" r="5" />
            <circle cx="140" cy="148" r="5" />
            <circle cx="76" cy="133" r="3" />
            <circle cx="124" cy="133" r="3" />
          </g>
        </svg>
      );
    case "sachet":
      return (
        <svg {...common}>
          <ellipse cx="100" cy="170" rx="44" ry="7" fill="#2a1a12" opacity="0.08" />
          <path d="M64 44h72l-4 122H68L64 44Z" fill="#e5a13a" />
          <path d="M64 44h72v14H64z" fill="#c98a2a" />
          <path d="M64 58l4 6 4-6 4 6 4-6 4 6 4-6 4 6 4-6 4 6 4-6 4 6 4-6 4 6 4-6 4 6 4-6 4 6 4-6" fill="none" stroke="#fbf6ee" strokeWidth="2" />
          <circle cx="100" cy="112" r="24" fill="#fbf6ee" />
          <path d="M90 104h18l-2 14a5 5 0 0 1-5 4h-4a5 5 0 0 1-5-4l-2-14Z" fill="#b5482a" />
          <path d="M108 107h3a3 3 0 0 1 0 6h-3" fill="none" stroke="#b5482a" strokeWidth="2" />
          <text x="100" y="152" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fontStyle="italic" fill="#2a1a12">
            one cup
          </text>
        </svg>
      );
  }
}
