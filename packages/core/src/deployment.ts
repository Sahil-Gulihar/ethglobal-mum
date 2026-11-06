/**
 * Written by the contracts deploy step (see docs/DEPLOYMENTS.md). Env NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS / PAYMENT_ROUTER_ADDRESS
 * override this at runtime (see getRouterAddress).
 */
/** PaymentRouter on Whitechain Sepolia (1874). Deploy tx 0x1d2827bfed5817deafb63df7d6c381fcbaed0d79ad4abfdede4fa9ea55c38b37. */
export const PAYMENT_ROUTER_ADDRESS = "0xa99a6D97607567f4fe734831910D24f4e9BD0508" as `0x${string}`;
export const PAYMENT_ROUTER_DEPLOY_BLOCK = 12373441n;

export function getRouterAddress(): `0x${string}` {
  const env =
    (typeof process !== "undefined" &&
      (process.env.PAYMENT_ROUTER_ADDRESS || process.env.NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS)) ||
    "";
  return (env || PAYMENT_ROUTER_ADDRESS) as `0x${string}`;
}
