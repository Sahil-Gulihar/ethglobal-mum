/**
 * Self-contained, prefixed styles (no Tailwind or CSS framework needed in the host app).
 * Tokens mirror docs/DESIGN.md (Geist-style, monochrome) and are scoped to `.wcc-root`.
 * Theme: `data-theme="light" | "dark"` forces a theme; `data-theme="auto"` follows
 * prefers-color-scheme live through a media query (no JS listener, no hydration mismatch).
 * Fonts: we never load fonts. The widget uses the host's Geist variable when present
 * (`--font-geist-sans`, as set by `geist/font`), else it inherits the host font.
 */

const LIGHT = `color-scheme:light;
--wcc-bg:oklch(1 0 0);--wcc-bg-2:oklch(0.984 0 0);--wcc-gray-100:oklch(0.961 0 0);
--wcc-gray-600:oklch(0.732 0 0);--wcc-fg-2:oklch(0.42 0 0);--wcc-fg:oklch(0.205 0 0);
--wcc-hover:oklch(0 0 0 / 0.05);--wcc-fill:oklch(0 0 0 / 0.081);--wcc-border:oklch(0 0 0 / 0.1);
--wcc-border-default:oklch(0 0 0 / 0.08);--wcc-border-strong:oklch(0 0 0 / 0.44);
--wcc-green-100:oklch(97.59% 0.0289 145.42);--wcc-green-900:oklch(51.75% 0.1453 147.65);
--wcc-amber-100:oklch(97.48% 0.0331 85.79);--wcc-amber-900:oklch(52.79% 0.1496 54.65);
--wcc-red-100:oklch(96.5% 0.0223 13.09);--wcc-red-700:oklch(62.56% 0.2524 23.03);--wcc-red-900:oklch(54.99% 0.232 25.29);
--wcc-focus:oklch(57.61% 0.2508 258.23);`;

const DARK = `color-scheme:dark;
--wcc-bg:oklch(0 0 0);--wcc-bg-2:oklch(0.027 0 0);--wcc-gray-100:oklch(0.218 0 0);
--wcc-gray-600:oklch(0.623 0 0);--wcc-fg-2:oklch(0.706 0 0);--wcc-fg:oklch(0.946 0 0);
--wcc-hover:oklch(1 0 0 / 0.07);--wcc-fill:oklch(1 0 0 / 0.09);--wcc-border:oklch(1 0 0 / 0.13);
--wcc-border-default:oklch(1 0 0 / 0.14);--wcc-border-strong:oklch(1 0 0 / 0.54);
--wcc-green-100:oklch(23.09% 0.0716 149.68);--wcc-green-900:oklch(73.1% 0.2158 148.29);
--wcc-amber-100:oklch(22.46% 0.0538 76.04);--wcc-amber-900:oklch(77.21% 0.1991 64.28);
--wcc-red-100:oklch(22.1% 0.0657 15.11);--wcc-red-700:oklch(62.56% 0.2234 23.03);--wcc-red-900:oklch(69.96% 0.2136 22.03);
--wcc-focus:oklch(71.7% 0.1648 250.794);`;

export const CSS = `
.wcc-root{${LIGHT}
position:relative;box-sizing:border-box;width:100%;max-width:400px;margin:0 auto;text-align:left;
color:var(--wcc-fg);background:var(--wcc-bg);border:1px solid var(--wcc-border);border-radius:8px;
font-family:var(--wcc-font-sans,var(--font-geist-sans));font-size:14px;line-height:20px;font-weight:400;
font-feature-settings:"rlig" 1,"calt" 0,"ss11" 1;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.wcc-root[data-theme=dark]{${DARK}}
@media (prefers-color-scheme:dark){.wcc-root[data-theme=auto]{${DARK}}}
.wcc-root *,.wcc-root *::before,.wcc-root *::after{box-sizing:border-box}
.wcc-root h2,.wcc-root p,.wcc-root dl,.wcc-root dd,.wcc-root ol{margin:0}
.wcc-root button{font:inherit;color:inherit;letter-spacing:inherit}
.wcc-root a{color:inherit;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px;
text-decoration-color:var(--wcc-gray-600);transition:text-decoration-color .15s ease}
.wcc-root a:hover{text-decoration-color:currentColor}
.wcc-root :focus-visible{outline:2px solid var(--wcc-focus);outline-offset:3px}
.wcc-root .wcc-wallet:focus-visible{outline-offset:2px}
.wcc-mono{font-family:var(--wcc-font-mono,var(--font-geist-mono,"Geist Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace));
font-size:13px;font-variant-ligatures:none;letter-spacing:0}

/* header: merchant + timer or status */
.wcc-head{display:flex;align-items:center;gap:12px;padding:20px 24px 0}
.wcc-avatar{flex:none;width:32px;height:32px;border-radius:6px;display:grid;place-items:center;font-size:14px;font-weight:500;
background:var(--wcc-gray-100);color:var(--wcc-fg);box-shadow:inset 0 0 0 1px var(--wcc-border)}
.wcc-merchant{min-width:0;flex:1}
.wcc-merchant-name{font-size:14px;line-height:20px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wcc-merchant-sub{display:flex;gap:4px;font-size:13px;line-height:18px;color:var(--wcc-fg-2);white-space:nowrap;min-width:0}
.wcc-merchant-sub .wcc-mono{font-size:12px;overflow:hidden;text-overflow:ellipsis}
.wcc-meta{flex:none;display:inline-flex;align-items:center;gap:6px;font-size:13px;line-height:18px;color:var(--wcc-fg-2);
font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap}
.wcc-meta[data-urgent=true]{color:var(--wcc-red-900)}

/* amount */
.wcc-amount{padding:24px 24px 20px}
.wcc-label{font-size:14px;line-height:20px;color:var(--wcc-fg-2)}
.wcc-amount-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 8px;margin-top:4px}
.wcc-amount-value{font-size:32px;line-height:1.15;font-weight:450;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.wcc-amount-cur{font-size:14px;line-height:20px;font-weight:500;color:var(--wcc-fg-2)}
.wcc-net{display:inline-flex;align-items:center;gap:6px;margin-top:12px;font-size:13px;line-height:18px;color:var(--wcc-fg-2)}
.wcc-dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--wcc-green-900)}
.wcc-dot[data-kind=warn]{background:var(--wcc-amber-900)}
.wcc-dot[data-kind=muted]{background:var(--wcc-gray-600)}
.wcc-sep{height:1px;margin:0 24px;background:var(--wcc-border)}

/* body: fixed minimum height and actions pinned to the bottom so states never jump */
.wcc-body{display:flex;flex-direction:column;min-height:268px;padding:20px 24px 24px;animation:wcc-fade .15s ease}
.wcc-body[data-center=true] .wcc-main{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.wcc-title{font-size:16px;line-height:24px;font-weight:500;letter-spacing:-.02em;text-wrap:balance}
.wcc-text{margin-top:4px;font-size:14px;line-height:20px;color:var(--wcc-fg-2);text-wrap:pretty}
.wcc-body[data-center=true] .wcc-text{max-width:300px}
.wcc-actions{margin-top:auto;padding-top:20px;display:flex;flex-direction:column;gap:4px}
.wcc-note{display:flex;align-items:center;justify-content:center;gap:6px;min-height:36px;font-size:13px;line-height:18px;
color:var(--wcc-fg-2);text-align:center;text-wrap:pretty}

/* wallets */
.wcc-wallets{display:flex;flex-direction:column;gap:8px;margin-top:16px}
.wcc-wallet{display:flex;align-items:center;gap:12px;width:100%;height:48px;padding:0 12px;border-radius:6px;cursor:pointer;
border:1px solid var(--wcc-border-default);background:var(--wcc-bg);text-align:left;font-size:14px;font-weight:500;
transition:background-color .15s ease,border-color .15s ease}
.wcc-wallet:hover:not(:disabled){background:var(--wcc-hover);border-color:var(--wcc-border)}
.wcc-wallet:disabled{cursor:not-allowed}
.wcc-wallet:disabled:not([data-busy=true]){opacity:.5}
.wcc-wallet img,.wcc-wallet-icon{flex:none;width:24px;height:24px;border-radius:6px}
.wcc-wallet-icon{display:grid;place-items:center;background:var(--wcc-gray-100);color:var(--wcc-fg-2)}
.wcc-wallet-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wcc-wallet-hint{display:inline-flex;align-items:center;gap:4px;font-size:13px;font-weight:400;color:var(--wcc-fg-2)}

/* key/value rows */
.wcc-rows{margin-top:16px;border-top:1px solid var(--wcc-border)}
.wcc-row{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:44px;padding:10px 0;
border-bottom:1px solid var(--wcc-border);font-size:14px;line-height:20px}
.wcc-row dt{flex:none;color:var(--wcc-fg-2)}
.wcc-row dd{display:inline-flex;align-items:center;justify-content:flex-end;gap:8px;min-width:0;font-weight:500;
font-variant-numeric:tabular-nums;text-align:right}
.wcc-row dd[data-bad=true]{color:var(--wcc-red-900)}
.wcc-link-btn{flex:none;height:24px;padding:0 6px;margin-right:-6px;border:0;border-radius:6px;background:none;cursor:pointer;
font-size:13px;font-weight:500;color:var(--wcc-fg-2)!important;transition:background-color .15s ease}
.wcc-link-btn:hover{background:var(--wcc-hover);color:var(--wcc-fg)!important}

/* progress */
.wcc-steps{list-style:none;margin-top:16px;padding:0;display:flex;flex-direction:column}
.wcc-step{display:flex;align-items:center;gap:12px;min-height:36px;font-size:14px;line-height:20px;color:var(--wcc-fg-2)}
.wcc-step[data-s=active]{color:var(--wcc-fg);font-weight:500}
.wcc-step-ic{flex:none;position:relative;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;
font-size:12px;line-height:1;font-weight:500;border:1px solid var(--wcc-border);color:var(--wcc-fg-2);
font-variant-numeric:tabular-nums;transition:background-color .15s ease,border-color .15s ease}
.wcc-step[data-s=active] .wcc-step-ic{border-color:var(--wcc-fg);color:var(--wcc-fg)}
.wcc-step[data-s=done] .wcc-step-ic{border-color:var(--wcc-fg);background:var(--wcc-fg);color:var(--wcc-bg)}
.wcc-step-note{margin-left:auto;font-size:13px;font-weight:400;color:var(--wcc-fg-2)}

/* buttons */
.wcc-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:40px;padding:0 16px;border:0;
border-radius:6px;cursor:pointer;font-size:14px;line-height:20px;font-weight:500;background:var(--wcc-fg);
color:var(--wcc-bg)!important;text-decoration:none!important;transition:opacity .15s ease,background-color .15s ease}
.wcc-btn:hover:not(:disabled){opacity:.9}
.wcc-btn:disabled{opacity:.5;cursor:not-allowed}
.wcc-btn[data-busy=true]:disabled{opacity:.85;cursor:progress}
.wcc-btn-2{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;height:36px;padding:0 12px;border-radius:6px;
border:1px solid var(--wcc-border-default);background:var(--wcc-bg);cursor:pointer;font-size:14px;line-height:20px;font-weight:500;
color:var(--wcc-fg)!important;text-decoration:none!important;transition:background-color .15s ease}
.wcc-btn-2:hover{background:var(--wcc-hover)}
.wcc-btn-ghost{display:flex;align-items:center;justify-content:center;width:100%;height:36px;padding:0 12px;border:0;border-radius:6px;
background:none;cursor:pointer;font-size:14px;font-weight:500;color:var(--wcc-fg-2)!important;text-decoration:none!important;
transition:background-color .15s ease,color .15s ease}
.wcc-btn-ghost:hover{background:var(--wcc-hover);color:var(--wcc-fg)!important}

/* alerts */
.wcc-alert{display:flex;gap:8px;align-items:flex-start;margin-top:16px;padding:10px 12px;border-radius:6px;font-size:13px;
line-height:18px;background:var(--wcc-red-100);color:var(--wcc-red-900);text-wrap:pretty}
.wcc-alert[data-kind=warn]{background:var(--wcc-amber-100);color:var(--wcc-amber-900)}
.wcc-alert[data-kind=info]{background:var(--wcc-bg-2);color:var(--wcc-fg);box-shadow:inset 0 0 0 1px var(--wcc-border)}
.wcc-alert > span{flex:1;min-width:0}
.wcc-alert a{text-decoration-color:currentColor;font-weight:500}
.wcc-alert-x{flex:none;display:grid;place-items:center;width:20px;height:20px;margin:-1px -4px -1px 0;border:0;border-radius:4px;
background:none;cursor:pointer;color:inherit!important;opacity:.8}
.wcc-alert-x:hover{opacity:1;background:var(--wcc-hover)}

/* status badges (success / expired / error) */
.wcc-badge{flex:none;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;margin-bottom:16px;
background:var(--wcc-gray-100);color:var(--wcc-fg-2)}
.wcc-badge[data-kind=success]{background:var(--wcc-green-100);color:var(--wcc-green-900)}
.wcc-badge[data-kind=error]{background:var(--wcc-red-100);color:var(--wcc-red-900)}
.wcc-check path{stroke-dasharray:24;stroke-dashoffset:24;animation:wcc-draw .3s .05s ease-out forwards}
.wcc-success-text{color:var(--wcc-green-900)}

.wcc-spin{flex:none;width:16px;height:16px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;
animation:wcc-rot .8s linear infinite}
.wcc-spin[data-size=sm]{width:12px;height:12px;border-width:1.5px}
.wcc-skel{display:block;border-radius:6px;background:var(--wcc-hover)}

.wcc-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px 6px;padding:12px 24px;
border-top:1px solid var(--wcc-border);border-radius:0 0 7px 7px;background:var(--wcc-bg-2);font-size:13px;line-height:18px;color:var(--wcc-fg-2)}
.wcc-foot b{font-weight:500;color:var(--wcc-fg)}
.wcc-foot-sep{color:var(--wcc-gray-600)}
.wcc-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

@keyframes wcc-fade{from{opacity:0}to{opacity:1}}
@keyframes wcc-rot{to{transform:rotate(360deg)}}
@keyframes wcc-draw{to{stroke-dashoffset:0}}
@media (max-width:440px){.wcc-head{padding:16px 20px 0}.wcc-amount{padding:20px 20px 16px}.wcc-sep{margin:0 20px}
.wcc-body{padding:20px 20px 20px}.wcc-foot{padding:12px 20px}.wcc-amount-value{font-size:28px}}
@media (pointer:coarse){.wcc-btn{height:44px}.wcc-btn-2,.wcc-btn-ghost{height:44px}}
@media (prefers-reduced-motion:reduce){.wcc-root *{transition:none!important}.wcc-body{animation:none}
.wcc-check path{animation:none;stroke-dashoffset:0}.wcc-spin{animation-duration:1.6s}}
`;
