# Design system (Vercel / Geist style)

Source: http://vercel.com/design.md and its foundation stylesheet https://vercel.com/geist/vercel-brand.css. Those are written for reports. This file adapts them to a product UI: the dashboard, hosted checkout, SDK widget and landing page. The **flows and layout** still follow MoonPay Commerce. The **visual language** follows this file. Brand: "Whitechain Commerce", with our own simple wordmark. Never use the Vercel logo or name.

## Principles
- Monochrome by default. Color only carries meaning (success, warning, error, info, focus), and is always paired with text or a shape. No brand accent color, no gradients, glows, colored side rails, decorative shadows, stock imagery or icon tiles.
- Earn every border. Use spacing first; a 1px subtle border only for real groups, controls, tables and dialogs. No nested cards.
- Stillness. Motion only confirms a state change: 150ms ease on background-color and border-color, plus a short dialog fade. No bounce, parallax, pulsing dots or scroll reveals. Respect `prefers-reduced-motion`.
- Sentence-case copy. No ALL-CAPS eyebrows or overlines, no em dashes (use commas, colons or parentheses), no hype words. Be concrete.

## Light and dark mode
- Both themes use the same tokens. Default to the OS preference (`prefers-color-scheme`), with an explicit override stored in localStorage (`wc-theme` = `light` | `dark` | `system`) and applied as `class="dark"` / `class="light"` on `<html>` before paint (inline script in `<head>`, no flash).
- A small theme control (System / Light / Dark) lives in the dashboard user menu and the landing page footer. It's a product UI, so a switcher is OK there. The hosted checkout and SDK widget follow the OS by default (`theme="auto"`), with an explicit `theme` prop override.
- Both themes need equivalent contrast (WCAG AA). Check tables, charts, focus rings and status colors in both.

## Tokens (OKLCH, light / dark)
| Token | Light | Dark |
|---|---|---|
| background-100 (page, primary surface) | `oklch(1 0 0)` | `oklch(0 0 0)` |
| background-200 (secondary surface, sidebar, table header) | `oklch(0.984 0 0)` | `oklch(0.027 0 0)` |
| gray-100 | `oklch(0.961 0 0)` | `oklch(0.218 0 0)` |
| gray-200 | `oklch(0.94 0 0)` | `oklch(0.239 0 0)` |
| gray-300 | `oklch(0.925 0 0)` | `oklch(0.281 0 0)` |
| gray-400 | `oklch(0.937 0 0)` | `oklch(0.301 0 0)` |
| gray-500 | `oklch(0.836 0 0)` | `oklch(0.39 0 0)` |
| gray-600 | `oklch(0.732 0 0)` | `oklch(0.623 0 0)` |
| gray-700 | `oklch(0.65 0 0)` | `oklch(0.65 0 0)` |
| gray-800 | `oklch(0.59 0 0)` | `oklch(0.59 0 0)` |
| gray-900 (secondary text) | `oklch(0.42 0 0)` | `oklch(0.706 0 0)` |
| gray-1000 (primary text) | `oklch(0.205 0 0)` | `oklch(0.946 0 0)` |
| gray-alpha-100 (hover fill) | `oklch(0 0 0 / 0.05)` | `oklch(1 0 0 / 0.07)` |
| gray-alpha-200 | `oklch(0 0 0 / 0.081)` | `oklch(1 0 0 / 0.09)` |
| gray-alpha-300 (border-subtle) | `oklch(0 0 0 / 0.1)` | `oklch(1 0 0 / 0.13)` |
| gray-alpha-400 (border-default) | `oklch(0 0 0 / 0.08)` | `oklch(1 0 0 / 0.14)` |
| gray-alpha-700 (border-strong) | `oklch(0 0 0 / 0.44)` | `oklch(1 0 0 / 0.54)` |
| blue-100 / 700 / 900 | `oklch(97.32% 0.0141 251.56)` / `oklch(57.61% 0.2508 258.23)` / `oklch(53.18% 0.2399 256.99)` | `oklch(22.17% 0.069 259.89)` / `oklch(57.61% 0.2321 258.23)` / `oklch(71.7% 0.1648 250.794)` |
| green-100 / 700 / 900 | `oklch(97.59% 0.0289 145.42)` / `oklch(64.58% 0.1746 147.27)` / `oklch(51.75% 0.1453 147.65)` | `oklch(23.09% 0.0716 149.68)` / `oklch(64.58% 0.199 147.27)` / `oklch(73.1% 0.2158 148.29)` |
| amber-100 / 700 / 900 | `oklch(97.48% 0.0331 85.79)` / `oklch(81.87% 0.1969 76.46)` / `oklch(52.79% 0.1496 54.65)` | `oklch(22.46% 0.0538 76.04)` / `oklch(81.87% 0.1969 76.46)` / `oklch(77.21% 0.1991 64.28)` |
| red-100 / 700 / 900 | `oklch(96.5% 0.0223 13.09)` / `oklch(62.56% 0.2524 23.03)` / `oklch(54.99% 0.232 25.29)` | `oklch(22.1% 0.0657 15.11)` / `oklch(62.56% 0.2234 23.03)` / `oklch(69.96% 0.2136 22.03)` |

Semantic tokens:
- text-primary = gray-1000; text-secondary = gray-900.
- border-subtle = alpha-300; border-default = alpha-400; border-strong = alpha-700.
- success = green-900; warning = amber-900; error = red-700; info = blue-700.
- focus = blue-700 (light) / blue-900 (dark).
- Status backgrounds, when a filled status is needed, use the matching -100 step with -900 text.

Wire these into Tailwind v4 (`@theme` plus CSS variables) and into the shadcn variables (`--background`, `--foreground`, `--muted`, `--border`, `--ring`, `--primary` = gray-1000, `--primary-foreground` = background-100, and so on), so existing components inherit them.

## Typography
- Geist Sans for everything; Geist Mono only for code, tx hashes, addresses, ids, API keys and timestamps (set only the identifier in mono). Use the `geist` npm package (`geist/font/sans`, `geist/font/mono`) in Next apps. The SDK widget uses `font-family: inherit` with a Geist-first fallback stack, and must not load fonts itself.
- Body 16px/24px weight 400 (14px/20px in dense UI: tables, controls, sidebar). Font features `"rlig" 1, "calt" 0, "ss11" 1`, antialiased.
- Scale: display 3rem/56px tracking -0.06em; page title 2.5rem/48px -0.06em (in the app shell, use 1.5rem/32px -0.04em for page h1); section 1.5rem/32px -0.04em; subsection 1.25rem/26px -0.02em; heading-16 1rem/24px -0.02em; lede 1.125rem/28px gray-900; compact 0.875rem/20px; label and metadata 0.8125rem/18-20px.
- Weights: 400 regular, 450 headings and stat values, 500 controls, labels and strong text. No other weights.
- Headings `text-wrap: balance`; paragraphs `text-wrap: pretty`; prose max 68ch.
- Numbers (amounts, counts) use tabular-nums. Stat value: clamp(1.5rem, 3vw, 2rem), weight 450, tracking -0.04em, line-height 1.15.

## Spacing, radius, layout
- Spacing scale (px): 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Within a group 8 to 16; between groups 24 to 32; sections 32 to 48.
- Radius: 6px controls and buttons; 8px surfaces, dialogs, tables and code blocks; 4px inline code and kbd. No pills, except a tiny status dot.
- Content width max 1200px; 12-column grid with 24px gutters on desktop, 6 on tablet, 4 on mobile.
- Shadows: none, except dialogs and popovers, which may use one very soft elevation (`0 8px 30px oklch(0 0 0 / 0.12)` light, `0 0 0 1px border-subtle` dark).

## Components
- Buttons: height 36px (44px touch on mobile), radius 6px, 14px/20px weight 500, horizontal padding 12 to 16px, no shadow.
  - Primary: bg gray-1000, text background-100; hover is slightly lighter (opacity 0.9).
  - Secondary: bg background-100, 1px border-default, text gray-1000; hover bg gray-alpha-100.
  - Tertiary or ghost: transparent; hover gray-alpha-100.
  - Destructive: red-700 bg, white text.
  - Disabled: opacity 0.5, not-allowed cursor.
- Inputs: height 36px, radius 6px, 1px border-default, bg background-100, 14px text, 12px padding. Placeholder gray-700. Hover border-strong. Focus: 2px focus-color outline, offset 2px. Mobile: 16px font, 44px height. Label above (13px weight 500); helper and error text below (13px; error red-900 with an icon or text).
- Focus ring everywhere: `outline: 2px solid var(--focus); outline-offset: 3px` on `:focus-visible`.
- Tables: 14px/20px; header row text-secondary 13px weight 500 on background-200; rows separated by a 1px border-subtle; hover row gray-alpha-100; numeric columns right-aligned with tabular-nums (header too); ids, hashes and addresses in Geist Mono; body cells baseline-aligned.
- Status ("Succeeded", "Refunded", "Pending", "Failed"): small text label, weight 500, 13px, with a 6px dot in the semantic color (success, warning, error, gray). Not a filled pill.
- Cards: avoid. Use sections with headings and spacing. When containment is needed (stat strip, settings group, checkout card), use 1px border-subtle, radius 8px, padding 24px, bg background-100.
- Stats: label 14px text-secondary above the value. No boxes around every stat; one bordered strip with dividers is OK.
- Dialogs: background-100, 1px border-subtle, radius 8px, padding 24px, soft elevation; overlay `oklch(0 0 0 / 0.4)` light, `/ 0.6` dark; title heading-20; actions right-aligned, primary last.
- Menus and popovers: background-100, border-subtle, radius 8px, items 36px tall at 14px, hover gray-alpha-100.
- Sidebar (app shell): background-200 with a 1px right border-subtle; nav items 14px weight 500 text-secondary, active item text-primary on gray-alpha-100 with radius 6px. Top bar: page title, a network label "Whitechain Sepolia" as plain metadata with a green dot, and the user menu.
- Links: inherit color, underline 1px, offset 3px, underline color gray-600; hover underline currentColor.
- Code blocks: Geist Mono 13px, line-height 1.55, bg background-200, 1px border-subtle, radius 8px, padding 16px, copy button top-right.
- Toasts: background gray-1000 with text background-100 (inverted), radius 8px, 14px.
- Empty states: one line of text-secondary plus one primary action. No illustrations.
- Charts (if any): monochrome series (gray-1000 / 900 / 800), direct labels, a zero baseline.

## Checkout widget specifics (packages/react)
- Uses the same tokens via scoped CSS variables under `.wcc-root[data-theme=light|dark]`; `theme="auto"` follows `prefers-color-scheme` live (listen for changes).
- Primary button = gray-1000 / background-100 (monochrome), full width, 40px tall. Success uses green-900 text with a check icon; errors use red. No brand accent.
- Amounts: large stat style (weight 450, tracking -0.04em, tabular-nums). Addresses and tx hashes in mono.

## Accessibility
Landmarks, one h1 per page, ordered headings, a skip link in the app shell, native controls, visible focus, labels on all inputs, AA contrast in both themes, never color alone, `min-width: 0` on grid and flex children, and no hidden overflow.
