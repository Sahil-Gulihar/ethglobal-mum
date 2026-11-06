import { ProductArt } from "./product-art";

/**
 * A product still life for the hero: the tin, a sachet and a cup arranged on one
 * warm ground with a table line, like a studio shot. Decorative only.
 */
export function HeroStillLife() {
  return (
    <figure className="relative">
      <div className="relative aspect-square overflow-hidden rounded-[3px] bg-[#efe0c8]" aria-hidden>
        {/* soft light from the upper left, and the table surface */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_10%,rgba(255,250,240,0.7),transparent_60%)]" />
        <div className="absolute inset-x-0 bottom-0 h-[38%] bg-[#e6d3b6]" />
        <div className="absolute inset-x-0 bottom-[38%] h-px bg-[#d9c3a2]" />

        <ProductArt
          art="sachet"
          className="absolute bottom-[27%] left-[0%] w-[42%] -rotate-[7deg] drop-shadow-[0_10px_14px_rgba(60,35,15,0.10)]"
        />
        <ProductArt
          art="tin"
          className="absolute bottom-[22%] left-[22%] w-[60%] drop-shadow-[0_18px_22px_rgba(60,35,15,0.14)]"
        />
        <ProductArt
          art="cup"
          className="absolute bottom-[6%] right-[-2%] w-[46%] drop-shadow-[0_16px_18px_rgba(60,35,15,0.14)]"
        />
      </div>
      <figcaption className="mt-3 text-[12.5px] text-muted">House masala blend, kulhad cup and tasting sachet</figcaption>
    </figure>
  );
}
