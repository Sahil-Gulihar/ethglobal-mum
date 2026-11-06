/** Self-contained, prefixed styles (no Tailwind or CSS framework needed in the host app). */
export const CSS = `
.wcc-root{--wcc-bg:#FFFFFF;--wcc-fg:#0B0B0C;--wcc-muted:#5C6068;--wcc-faint:#646870;--wcc-border:#E5E6EA;--wcc-soft:#F3F3F3;
--wcc-accent:#0B0B0C;--wcc-accent-hover:#292929;--wcc-accent-fg:#FFFFFF;--wcc-accent-soft:rgba(11,11,12,.05);
--wcc-danger:#E5484D;--wcc-danger-soft:rgba(229,72,77,.08);--wcc-success:#17B26A;--wcc-success-soft:rgba(23,178,106,.12);
--wcc-warn:#B25E09;--wcc-warn-soft:#FFF5E6;--wcc-shadow:0 1px 3px rgba(11,11,12,.035);
box-sizing:border-box;width:100%;max-width:440px;margin:0 auto;color:var(--wcc-fg);background:var(--wcc-bg);
border:1px solid var(--wcc-border);border-radius:6px;box-shadow:var(--wcc-shadow);overflow:hidden;text-align:left;
font-family:var(--font-sans,"Helvetica Neue",ui-sans-serif,system-ui,sans-serif);
font-size:14px;line-height:1.45;-webkit-font-smoothing:antialiased}
.wcc-root[data-theme=dark]{--wcc-bg:#101010;--wcc-fg:#FFFFFF;--wcc-muted:#A0A0A0;--wcc-faint:#898989;--wcc-border:#343434;--wcc-soft:#1C1C1C;
--wcc-accent:#FFFFFF;--wcc-accent-hover:#E5E5E5;--wcc-accent-fg:#101010;--wcc-accent-soft:rgba(255,255,255,.05);--wcc-danger-soft:rgba(229,72,77,.14);
--wcc-warn:#F5B35C;--wcc-warn-soft:rgba(245,179,92,.10);--wcc-success-soft:rgba(23,178,106,.16);
--wcc-shadow:0 1px 3px rgba(0,0,0,.06)}
.wcc-root *,.wcc-root *::before,.wcc-root *::after{box-sizing:border-box}
.wcc-root a{color:var(--wcc-accent);text-decoration:none}
.wcc-root a:hover{text-decoration:underline}
.wcc-root button{font:inherit;color:inherit}
.wcc-head{display:flex;align-items:center;gap:12px;padding:28px 28px 0}
.wcc-avatar{flex:none;width:40px;height:40px;border-radius:4px;display:grid;place-items:center;font-weight:700;font-size:15px;
color:var(--wcc-accent-fg);background:var(--wcc-accent)}
.wcc-merchant{min-width:0;flex:1}
.wcc-merchant-name{font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wcc-merchant-sub{font-size:12px;color:var(--wcc-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wcc-pill{flex:none;display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:0;font-size:12px;font-weight:500;
background:var(--wcc-soft);color:var(--wcc-muted);font-variant-numeric:tabular-nums}
.wcc-pill[data-urgent=true]{color:var(--wcc-danger);background:var(--wcc-danger-soft)}
.wcc-amount{padding:32px 28px 24px}
.wcc-label{font-size:12px;color:var(--wcc-muted);font-weight:500;letter-spacing:.01em}
.wcc-amount-row{display:flex;align-items:baseline;gap:8px;margin-top:4px}
.wcc-amount-value{font-size:42px;line-height:1.05;font-weight:650;letter-spacing:-.045em;font-variant-numeric:tabular-nums}
.wcc-amount-cur{display:inline-flex;align-items:center;gap:6px;font-size:16px;font-weight:600;color:var(--wcc-muted)}
.wcc-body{padding:0 28px 28px;animation:wcc-in .28s cubic-bezier(.2,.8,.2,1)}
.wcc-divider{height:1px;background:var(--wcc-border);margin:0 28px 24px}
.wcc-title{font-weight:650;font-size:16px;margin:0 0 6px;letter-spacing:-.01em}
.wcc-text{color:var(--wcc-muted);margin:0 0 14px;font-size:13px}
.wcc-wallets{display:flex;flex-direction:column;gap:8px;margin-top:12px}
.wcc-wallet{display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;border-radius:4px;cursor:pointer;
border:1px solid var(--wcc-border);background:var(--wcc-bg);text-align:left;transition:border-color .15s,background .15s,transform .15s}
.wcc-wallet:hover:not(:disabled){border-color:var(--wcc-accent);background:var(--wcc-accent-soft)}
.wcc-wallet:active:not(:disabled){transform:scale(.99)}
.wcc-wallet:disabled{opacity:.6;cursor:default}
.wcc-wallet img,.wcc-wallet-icon{width:32px;height:32px;border-radius:9px;flex:none}
.wcc-wallet-icon{display:grid;place-items:center;background:var(--wcc-soft);color:var(--wcc-muted)}
.wcc-wallet-name{flex:1;font-weight:600}
.wcc-wallet-hint{font-size:12px;color:var(--wcc-faint)}
.wcc-rows{border:1px solid var(--wcc-border);border-radius:4px;padding:4px 16px;margin-bottom:18px}
.wcc-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 0;font-size:13px}
.wcc-row+.wcc-row{border-top:1px solid var(--wcc-border)}
.wcc-row-k{color:var(--wcc-muted)}
.wcc-row-v{font-weight:500;display:inline-flex;align-items:center;gap:8px;min-width:0;text-align:right;font-variant-numeric:tabular-nums}
.wcc-row-v[data-bad=true]{color:var(--wcc-danger)}
.wcc-link-btn{background:none;border:0;padding:0;cursor:pointer;color:var(--wcc-accent)!important;font-size:12px;font-weight:500}
.wcc-link-btn:hover{text-decoration:underline}
.wcc-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
.wcc-steps{list-style:none;margin:0 0 16px;padding:0;display:flex;flex-direction:column;gap:2px}
.wcc-step{display:flex;align-items:center;gap:10px;padding:7px 0;font-size:13px;color:var(--wcc-faint);transition:color .2s}
.wcc-step[data-s=active]{color:var(--wcc-fg);font-weight:500}
.wcc-step[data-s=done]{color:var(--wcc-muted)}
.wcc-step-ic{flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:600;
border:1.5px solid var(--wcc-border);color:var(--wcc-faint);transition:all .2s}
.wcc-step[data-s=active] .wcc-step-ic{border-color:var(--wcc-accent);color:var(--wcc-accent);background:var(--wcc-accent-soft)}
.wcc-step[data-s=done] .wcc-step-ic{border-color:var(--wcc-success);background:var(--wcc-success);color:#fff}
.wcc-step-note{margin-left:auto;font-size:12px;font-weight:400;color:var(--wcc-muted)}
.wcc-btn{position:relative;display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:44px;border:0;border-radius:4px;
cursor:pointer;font-weight:600;font-size:15px;background:var(--wcc-accent);color:var(--wcc-accent-fg)!important;
transition:background .15s,transform .1s,opacity .15s;text-decoration:none!important}
.wcc-btn:hover:not(:disabled){background:var(--wcc-accent-hover)}
.wcc-btn:active:not(:disabled){transform:scale(.985)}
.wcc-btn:disabled{opacity:.55;cursor:default}
.wcc-btn[data-busy=true]:disabled{opacity:.88;cursor:progress}
.wcc-btn:focus-visible,.wcc-wallet:focus-visible,.wcc-btn-ghost:focus-visible{outline:2px solid var(--wcc-accent);outline-offset:2px}
.wcc-btn-ghost{display:block;width:100%;margin-top:8px;padding:10px;border:0;border-radius:4px;background:none;cursor:pointer;
color:var(--wcc-muted)!important;font-size:13px;font-weight:500;text-align:center}
.wcc-btn-ghost:hover{background:var(--wcc-soft);text-decoration:none!important}
.wcc-alert{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:4px;font-size:13px;margin-bottom:14px;
background:var(--wcc-danger-soft);color:var(--wcc-danger);animation:wcc-in .2s ease-out}
.wcc-alert[data-kind=warn]{background:var(--wcc-warn-soft);color:var(--wcc-warn)}
.wcc-alert[data-kind=info]{background:var(--wcc-accent-soft);color:var(--wcc-accent)}
.wcc-alert a{color:inherit;text-decoration:underline;font-weight:600}
.wcc-alert-x{margin-left:auto;background:none;border:0;cursor:pointer;color:inherit!important;opacity:.7;padding:0 2px;font-size:16px;line-height:1}
.wcc-center{display:flex;flex-direction:column;align-items:center;text-align:center;padding:8px 0 4px}
.wcc-center .wcc-text{max-width:300px}
.wcc-badge-ic{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;margin:4px 0 14px}
.wcc-badge-ic[data-kind=success]{background:var(--wcc-success-soft);color:var(--wcc-success)}
.wcc-badge-ic[data-kind=muted]{background:var(--wcc-soft);color:var(--wcc-muted)}
.wcc-badge-ic[data-kind=accent]{background:var(--wcc-accent-soft);color:var(--wcc-accent)}
.wcc-check path{stroke-dasharray:30;stroke-dashoffset:30;animation:wcc-draw .5s .1s cubic-bezier(.65,0,.35,1) forwards}
.wcc-pop{animation:wcc-pop .45s cubic-bezier(.2,1.4,.4,1)}
.wcc-spin{width:18px;height:18px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:wcc-rot .7s linear infinite;flex:none}
.wcc-spin-lg{width:40px;height:40px;border-width:3px;color:var(--wcc-accent)}
.wcc-skel{border-radius:6px;background:linear-gradient(90deg,var(--wcc-soft) 0%,var(--wcc-border) 50%,var(--wcc-soft) 100%);
background-size:200% 100%;animation:wcc-shim 1.2s ease-in-out infinite}
.wcc-foot{display:flex;align-items:center;justify-content:center;gap:6px;padding:16px 28px;border-top:1px solid var(--wcc-border);
background:var(--wcc-bg);font-size:11.5px;color:var(--wcc-faint)}
.wcc-foot b{color:var(--wcc-muted);font-weight:600}
.wcc-foot-sep{opacity:.5}
.wcc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@keyframes wcc-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@keyframes wcc-rot{to{transform:rotate(360deg)}}
@keyframes wcc-shim{0%{background-position:100% 0}100%{background-position:-100% 0}}
@keyframes wcc-draw{to{stroke-dashoffset:0}}
@keyframes wcc-pop{0%{transform:scale(.6);opacity:0}100%{transform:scale(1);opacity:1}}
@media (max-width:440px){.wcc-root{border-radius:6px}.wcc-head{padding:24px 22px 0}.wcc-amount{padding:28px 22px 22px}.wcc-body{padding:0 22px 24px}.wcc-divider{margin:0 22px 22px}.wcc-amount-value{font-size:36px}}
@media (prefers-reduced-motion:reduce){.wcc-root *:not(.wcc-spin){animation-duration:.01ms!important;transition:none!important}}
.wcc-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
`;
