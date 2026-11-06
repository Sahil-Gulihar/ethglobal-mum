/**
 * Filled in by the contracts deploy step. Env NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS / PAYMENT_ROUTER_ADDRESS
 * override this at runtime (see getRouterAddress).
 */
export const PAYMENT_ROUTER_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;
export const PAYMENT_ROUTER_DEPLOY_BLOCK = 0n;

export function getRouterAddress(): `0x${string}` {
  const env =
    (typeof process !== "undefined" &&
      (process.env.PAYMENT_ROUTER_ADDRESS || process.env.NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS)) ||
    "";
  return (env || PAYMENT_ROUTER_ADDRESS) as `0x${string}`;
}
