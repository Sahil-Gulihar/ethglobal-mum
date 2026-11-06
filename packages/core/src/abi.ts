/**
 * PaymentRouter ABI. This is the frozen interface; contracts/src/PaymentRouter.sol must match it exactly.
 * If the contract agent must change it, update this file in the same commit.
 */
export const paymentRouterAbi = [
  { type: "constructor", inputs: [{ name: "usdt", type: "address" }, { name: "owner", type: "address" }], stateMutability: "nonpayable" },
  { type: "function", name: "usdt", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "owner", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  {
    type: "function", name: "registerMerchant",
    inputs: [{ name: "merchantId", type: "bytes32" }, { name: "payout", type: "address" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "merchantPayout",
    inputs: [{ name: "merchantId", type: "bytes32" }],
    outputs: [{ type: "address" }], stateMutability: "view",
  },
  {
    type: "function", name: "pay",
    inputs: [{ name: "merchantId", type: "bytes32" }, { name: "orderId", type: "bytes32" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "paymentId", type: "bytes32" }], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "refund",
    inputs: [{ name: "paymentId", type: "bytes32" }, { name: "amount", type: "uint256" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "getPayment",
    inputs: [{ name: "paymentId", type: "bytes32" }],
    outputs: [{
      type: "tuple", components: [
        { name: "merchantId", type: "bytes32" },
        { name: "orderId", type: "bytes32" },
        { name: "payer", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "refunded", type: "uint256" },
      ],
    }], stateMutability: "view",
  },
  {
    type: "function", name: "paymentIdOf",
    inputs: [{ name: "merchantId", type: "bytes32" }, { name: "orderId", type: "bytes32" }],
    outputs: [{ type: "bytes32" }], stateMutability: "pure",
  },
  {
    type: "event", name: "MerchantRegistered", anonymous: false,
    inputs: [{ name: "merchantId", type: "bytes32", indexed: true }, { name: "payout", type: "address", indexed: false }],
  },
  {
    type: "event", name: "PaymentSettled", anonymous: false,
    inputs: [
      { name: "paymentId", type: "bytes32", indexed: true },
      { name: "merchantId", type: "bytes32", indexed: true },
      { name: "orderId", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: false },
      { name: "payout", type: "address", indexed: false },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "Refunded", anonymous: false,
    inputs: [
      { name: "paymentId", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "totalRefunded", type: "uint256", indexed: false },
    ],
  },
] as const;

export const erc20Abi = [
  { type: "function", name: "decimals", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "symbol", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { type: "function", name: "balanceOf", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "allowance", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "approve", inputs: [{ name: "s", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
] as const;
