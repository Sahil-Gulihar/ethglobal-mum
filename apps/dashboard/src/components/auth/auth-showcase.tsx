"use client";

import { Bar, Check, Row, Stage, Text, Window } from "@/components/stageshow/kit";
import "./auth-showcase.css";

// A still for the sign-in panel, built on the Stageshow "overlap" gold: the
// buyer's hosted checkout receipt in front of the merchant's payments list it
// reports to. Two views of one payment.
//
// - The window is pinned a gutter from the top and right and runs off the
//   bottom of the panel; the receipt crosses its left edge and stops 24px
//   short of the sidebar line, so it covers filler, never the table.
// - Real strings: the title, the settled row (amount, tx hash, status) and
//   the receipt (Paid, amount, network). Everything else is a bar.
// - Colors come from the app's own CSS variables, so the still follows the
//   light and dark theme with the rest of the page. It does not move.

const W = 720;
const H = 860;

const NAV = [64, 82, 58, 74, 52];
// Neighbor rows: title and subtitle bar widths, varied row to row
const ROWS: [number, number][] = [
  [58, 132],
  [66, 108],
  [52, 146],
  [62, 98],
  [56, 124],
  [64, 112],
  [54, 138],
  [60, 104],
  [50, 128],
];

export function AuthShowcase() {
  return (
    <Stage width={W} height={H} fill palette="mono" className="wc-show">
      {() => (
        <>
          <Window
            title="Payments"
            lights="grey"
            sidebarWidth={152}
            className="wc-show__win"
            sidebar={
              <div className="wc-show__nav">
                {NAV.map((w, i) => (
                  <div key={i} className="wc-show__nav-item" data-on={i === 1 || undefined}>
                    <Bar w={12} h={12} r={3} tone={i === 1 ? 5 : 3} />
                    <Bar w={w} h={6} r={3} tone={i === 1 ? 5 : 2} />
                  </div>
                ))}
              </div>
            }
          >
            <div className="wc-show__main">
              <div className="wc-show__stats">
                {[
                  [44, 86],
                  [52, 40],
                  [38, 64],
                ].map(([a, b], i) => (
                  <div key={i} className="wc-show__stat">
                    <Bar w={a} h={6} r={3} tone={2} />
                    <Bar w={b} h={12} r={4} tone={3} />
                  </div>
                ))}
              </div>

              <div className="wc-show__list">
                <Row
                  pad={0}
                  selected
                  className="wc-show__row"
                  title={<Text className="wc-show__amount">49.99 USDT</Text>}
                  subtitle={<Text className="wc-show__hash">0x8f3a…c21e</Text>}
                >
                  <span className="wc-show__status">
                    <span className="wc-show__dot" />
                    <Text>Succeeded</Text>
                  </span>
                </Row>
                {ROWS.map(([t, s], i) => (
                  <Row
                    key={i}
                    pad={0}
                    className="wc-show__row"
                    title={<Bar w={t} h={7} r={3} tone={3} />}
                    subtitle={<Bar w={s} h={6} r={3} tone={2} />}
                  >
                    <span className="wc-show__status">
                      <span className="wc-show__dot" data-muted />
                      <Bar w={i % 3 === 1 ? 44 : 54} h={6} r={3} tone={2} />
                    </span>
                  </Row>
                ))}
              </div>
            </div>
          </Window>

          <section className="wc-show__receipt">
            <div className="wc-show__paid">
              <Check on size={16} />
              <Text>Paid</Text>
            </div>
            <div className="wc-show__total">
              <Text className="wc-show__total-num">49.99</Text>
              <Text className="wc-show__total-unit">USDT</Text>
            </div>
            <div className="wc-show__lines">
              <div className="wc-show__line">
                <Bar w={42} h={6} r={3} tone={2} />
                <Bar w={70} h={6} r={3} tone={3} />
              </div>
              <div className="wc-show__line">
                <Bar w={54} h={6} r={3} tone={2} />
                <Bar w={48} h={6} r={3} tone={3} />
              </div>
            </div>
            <div className="wc-show__network">
              <span className="wc-show__dot" />
              <Text>Whitechain Sepolia</Text>
            </div>
          </section>
        </>
      )}
    </Stage>
  );
}
