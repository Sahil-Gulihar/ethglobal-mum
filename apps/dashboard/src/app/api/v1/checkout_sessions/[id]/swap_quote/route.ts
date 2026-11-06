import { USDT_ADDRESS } from "@whitechain-commerce/core";
import { apiError } from "@/lib/api-auth";
import { getPublicCheckoutSession } from "@/lib/sessions";
import { handle, json, preflight } from "../../../_http";

const tokens = {
  WBT: "0x4200000000000000000000000000000000000006",
  ETH: "0x1c7e0793c69838d1da9d5b98b5893866b977ba67",
} as const;

export const OPTIONS = preflight;

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const input: { asset?: unknown; amount?: unknown; side?: unknown } | null = await req.json().catch(() => null);
  const asset = input?.asset;
  const amount = input?.amount;
  const side = input?.side ?? "EXACT_INPUT";
  if ((side !== "EXACT_INPUT" && side !== "EXACT_OUTPUT") ||
    (asset !== "WBT" && asset !== "ETH") || typeof amount !== "string" || !/^[1-9]\d{0,29}$/.test(amount)) {
    return apiError(400, "invalid_request", "Enter a valid swap amount.");
  }

  const { id } = await ctx.params;
  const session = await getPublicCheckoutSession(id);
  if (!session) return apiError(404, "not_found", "Checkout session not found.");
  if (session.status !== "open" || session.tokenAddress.toLowerCase() !== USDT_ADDRESS.toLowerCase()) {
    return apiError(400, "invalid_request", "Swaps are unavailable for this checkout.");
  }

  const tokenIn = tokens[asset];
  try {
    const response = await fetch("https://api.testnet.yetitrade.fi/api/v1/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenIn, tokenOut: USDT_ADDRESS, amount, side, slippageBps: 50 }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    const { data } = await response.json();
    const pool = data?.route?.[0]?.[0];
    if (
      !response.ok || data?.chainId !== 1874 || (side === "EXACT_INPUT" ? data.amountIn : data.amountOut) !== amount || data.side !== side ||
      data.route?.length !== 1 || data.route[0]?.length !== 1 || pool?.type !== "V3_POOL" ||
      pool.tokenIn?.address?.toLowerCase() !== tokenIn || pool.tokenOut?.address?.toLowerCase() !== USDT_ADDRESS.toLowerCase() ||
      ![100, 500, 3000, 10000].includes(pool.feeTier) ||
      typeof data.amountIn !== "string" || !/^[1-9]\d{0,29}$/.test(data.amountIn) ||
      typeof data.amountOut !== "string" || !/^[1-9]\d{0,29}$/.test(data.amountOut)
    ) {
      return apiError(502, "server_error", "YetiTrade could not quote a direct swap for this amount.");
    }
    return json({ amountIn: data.amountIn, amountOut: data.amountOut, fee: pool.feeTier });
  } catch {
    return apiError(502, "server_error", "YetiTrade is unavailable. Try again shortly.");
  }
});
