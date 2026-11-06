"use client";

import { Bar, Check, Collapse, Stage, States, Swap, Text, Window, type Act } from "@/components/stageshow/kit";
import { useSiteTheme } from "./use-site-theme";
import "./checkout-hero.css";

// The landing hero: a customer pays Chai & Co. 49.99 USDT on the hosted
// checkout, and the payment lands at the top of the merchant's dashboard.
//
// Gold: examples/overlap (the buyer's card over the merchant's dashboard),
// with the button states of examples/form-error and the row arrival of
// examples/dark-hero. Beats: Connect wallet is pressed and the Pay from row
// opens as the label becomes Pay 49.99 USDT; Pay is pressed; Confirm in your
// wallet turns; Payment complete settles on the same button and the footer
// shows the tx; a beat later the row opens at the top of Payments, pushing
// the older rows down. Holds, then the loop's additions leave in one reverse
// stagger and the card is back where it began.
//
// Real strings: the merchant, order, total, network, wallet, the button and
// tx on the card; the dashboard's title, network and three rows. The rest is
// placeholder.

type Phase = "idle" | "confirm" | "paid";
type S = { wallet: boolean; phase: Phase; row: boolean };

const initial: S = { wallet: false, phase: "idle", row: false };
const POSTER: S = { wallet: true, phase: "paid", row: true };

const REST = { wide: { x: 330, y: 452 }, compact: { x: 300, y: 150 } };

async function script(a: Act<S>) {
  await a.wait(900);
  await a.move({ at: "pay", x: 0.86, y: 0.62 });
  await a.wait(250);
  await a.click();
  a.mark("connect");
  await a.set({ wallet: true });
  await a.wait(1300);
  // The label changed under the hand; press it again where it stands
  await a.click();
  a.mark("confirm");
  await a.set({ phase: "confirm" });
  await a.wait(1700);
  a.mark("paid");
  await a.set({ phase: "paid" });
  // The cursor clears the card; the consequence lands in the dashboard
  void a.move("rest");
  await a.wait(700);
  a.mark("row");
  await a.set({ row: true });
  await a.wait(2600);
  // What the loop added leaves as one motion, last change first
  a.put({ row: false });
  await a.wait(90);
  a.put({ phase: "idle" });
  await a.wait(90);
  a.put({ wallet: false });
  await a.wait(1000);
}

type Old = { amount: string; status: "Succeeded" | "Refunded"; order: string; when: string };
const OLD: Old[] = [
  { amount: "24.00", status: "Succeeded", order: "#4820", when: "12m ago" },
  { amount: "18.50", status: "Refunded", order: "#4817", when: "1h ago" },
];
const FILLER = [
  [64, 70, 44, 52],
  [52, 70, 40, 46],
  [70, 70, 46, 56],
  [58, 70, 42, 48],
];

export function CheckoutHero() {
  const theme = useSiteTheme();
  return (
    <Stage<S>
      width={1152}
      height={480}
      compact={{ below: 720, width: 358, height: 560 }}
      theme={theme}
      palette="mono"
      initial={initial}
      poster={POSTER}
      script={script}
      cursor={{ at: REST }}
      className="wch"
    >
      {(s, _rect, layout) => {
        const compact = layout === "compact";
        return (
          <>
            <Window
              className="wch-win"
              sidebarWidth={216}
              sidebar={compact ? undefined : <Sidebar />}
            >
              <div className="wch-main">
                <div className="wch-head">
                  <Text className="wch-title">Payments</Text>
                  <span className="wch-net">
                    <i className="wch-dot" data-tone="success" />
                    <Text>Whitechain Sepolia</Text>
                  </span>
                </div>
                <div className="wch-table" data-crop>
                  <div className="wch-tr wch-th">
                    <Text>Amount</Text>
                    <Text>Status</Text>
                    {!compact && <Text>Order</Text>}
                    <Text className="wch-end">Date</Text>
                  </div>
                  <Collapse open={s.row}>
                    <PaymentRow compact={compact} amount="49.99" status="Succeeded" order="#4821" when="Just now" fresh />
                  </Collapse>
                  {OLD.map((r) => (
                    <PaymentRow key={r.order} compact={compact} {...r} />
                  ))}
                  {FILLER.map((w, i) => (
                    <div key={i} className="wch-tr">
                      <Bar w={w[0]} h={7} r={3.5} tone={3} />
                      <Bar w={w[1]} h={7} r={3.5} tone={2} />
                      {!compact && <Bar w={w[2]} h={7} r={3.5} tone={2} />}
                      <Bar className="wch-end" w={w[3]} h={7} r={3.5} tone={2} />
                    </div>
                  ))}
                </div>
              </div>
            </Window>

            <section className="wch-card" aria-hidden>
              <div className="wch-merchant">
                <Text className="wch-strong">Chai &amp; Co.</Text>
                <Text className="wch-faint">Order #4821</Text>
              </div>
              <div className="wch-total">
                <Text className="wch-label">Total due</Text>
                <span className="wch-amount">
                  <Text>49.99</Text>
                  <span className="wch-unit">USDT</span>
                </span>
              </div>
              <div className="wch-facts">
                <div className="wch-fact">
                  <Text className="wch-label">Network</Text>
                  <Text className="wch-value">Whitechain Sepolia</Text>
                </div>
                <Collapse open={s.wallet}>
                  <div className="wch-fact">
                    <Text className="wch-label">Pay from</Text>
                    <Text className="wch-value wch-mono">0x7a3f…91c2</Text>
                  </div>
                </Collapse>
              </div>
              <span className="wch-pay" data-target="pay" data-cursor="pointer" data-phase={s.phase}>
                <span className="wch-layer" data-on={s.phase === "idle" || undefined}>
                  <Swap id={s.wallet ? "pay" : "connect"}>{s.wallet ? "Pay 49.99 USDT" : "Connect wallet"}</Swap>
                </span>
                <span className="wch-layer" data-on={s.phase !== "idle" || undefined}>
                  <Check on={s.phase === "paid"} pending={s.phase === "confirm"} size={14} />
                  <span className="wch-labels">
                    <span className="wch-word" data-on={s.phase === "confirm" || undefined}>
                      Confirm in your wallet
                    </span>
                    <span className="wch-word" data-on={s.phase === "paid" || undefined}>
                      Payment complete
                    </span>
                  </span>
                </span>
              </span>
              <States
                className="wch-foot"
                value={s.phase === "paid" ? "tx" : "note"}
                states={{
                  note: <Text className="wch-faint">Paid straight to the merchant&apos;s wallet</Text>,
                  tx: (
                    <span className="wch-tx">
                      <Text className="wch-faint">Tx</Text>
                      <Text className="wch-mono wch-value">0x9c1e…4b7a</Text>
                    </span>
                  ),
                }}
              />
            </section>
            <span data-target="rest" style={{ position: "absolute", left: REST[layout].x, top: REST[layout].y }} />
          </>
        );
      }}
    </Stage>
  );
}

function Sidebar() {
  return (
    <div className="wch-side">
      {[56, 72, 64, 48, 60].map((w, i) => (
        <span key={i} className="wch-nav" data-on={i === 1 || undefined}>
          <Bar w={14} h={14} r={4} tone={i === 1 ? 4 : 2} />
          <Bar w={w} h={7} r={3.5} tone={i === 1 ? 4 : 2} />
        </span>
      ))}
    </div>
  );
}

function PaymentRow({ amount, status, order, when, fresh, compact }: Old & { fresh?: boolean; compact: boolean }) {
  return (
    <div className="wch-tr" data-fresh={fresh || undefined}>
      <span className="wch-amt">
        <Text>{amount}</Text>
        <span className="wch-unit">USDT</span>
      </span>
      <span className="wch-status">
        <i className="wch-dot" data-tone={status === "Succeeded" ? "success" : "neutral"} />
        <Text>{status}</Text>
      </span>
      {!compact && <Text className="wch-mono wch-order">{order}</Text>}
      <Text className="wch-end wch-when">{when}</Text>
    </div>
  );
}
