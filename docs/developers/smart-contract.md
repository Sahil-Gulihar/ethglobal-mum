---
title: "Smart contract"
description: "The PaymentRouter contract moves USDT from the customer straight to your payout wallet, and back again for refunds."
---

Every Whitechain Commerce payment and refund is a call to one small, non-upgradeable contract on Whitechain Sepolia. It records which order was paid, emits an event that links the transfer to the order, and never holds a token balance. This page lists its full interface and shows how to check any payment on the chain yourself.

## Deployment

| | |
| --- | --- |
| Network | Whitechain Sepolia, chain id `1874` (`0x752`) |
| PaymentRouter | [`0xa99a6D97607567f4fe734831910D24f4e9BD0508`](https://explorer.testnet.whitechain.io/address/0xa99a6D97607567f4fe734831910D24f4e9BD0508) |
| Deploy transaction | [`0x1d2827bf…c38b37`](https://explorer.testnet.whitechain.io/tx/0x1d2827bfed5817deafb63df7d6c381fcbaed0d79ad4abfdede4fa9ea55c38b37) |
| Deploy block | `12373441` |
| Owner (backend signer) | [`0xA8d17110550f389801470A0088e423C72C5A9c12`](https://explorer.testnet.whitechain.io/address/0xA8d17110550f389801470A0088e423C72C5A9c12) |
| Token | USDT [`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`](https://explorer.testnet.whitechain.io/token/0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7), 6 decimals |
| Compiler | solc `0.8.30`, optimizer on (200 runs), EVM version `prague`, OpenZeppelin Contracts `v5.7.0` |
| Source | [`contracts/src/PaymentRouter.sol`](https://github.com/Sahil-Gulihar/ethglobal-mum/blob/main/contracts/src/PaymentRouter.sol) |
| Public RPC | `https://rpc.testnet.whitechain.io` |
| Explorer | https://explorer.testnet.whitechain.io (Blockscout) |

Use `https://rpc.testnet.whitechain.io`, with a dot. The similar-looking `https://rpc-testnet.whitechain.io` (with a hyphen) is a different network (chain id `2625`).

### Source verification

| Verifier | Status |
| --- | --- |
| Sourcify | Verified, exact match for creation and runtime bytecode: [sourcify.dev](https://sourcify.dev/server/v2/contract/1874/0xa99a6D97607567f4fe734831910D24f4e9BD0508) |
| Whitechain explorer (Blockscout) | Verified: [explorer](https://explorer.testnet.whitechain.io/address/0xa99a6D97607567f4fe734831910D24f4e9BD0508) |

Both matches prove the deployed bytecode was built from `contracts/src/PaymentRouter.sol`.

## How it fits together

1. When you register a payout wallet in the dashboard, the backend signer (the contract owner) calls `registerMerchant(merchantId, payout)`.
2. At checkout, the customer's wallet calls `approve(router, amount)` on USDT, then `pay(merchantId, orderId, amount)` on the router. The [checkout widget](./checkout-widget.md) does both. It skips the approval when the existing allowance already covers the amount, and first resets a non-zero allowance to 0 if the token rejects changing it directly.
3. `pay` transfers the USDT from the customer to your payout wallet in the same call and emits `PaymentSettled`.
4. The indexer reads `PaymentSettled`, runs the [settlement checks](#settlement-checks), marks the session `paid` and sends [`payment.succeeded`](./webhooks.md).
5. To refund, your payout wallet approves the router and calls `refund(paymentId, amount)`. The USDT goes from your payout wallet back to the original payer, and the contract emits `Refunded`. See [refunds](./refunds.md).

## Ids

The contract works with three `bytes32` ids. All of them are keccak256 hashes, so anyone who knows the off-chain ids can recompute them.

| Onchain id | Derived from | Formula |
| --- | --- | --- |
| `merchantId` | Your merchant id (`mer_...`) | `keccak256(utf8(merchant.id))` |
| `orderId` | The checkout session id (`cs_...`) | `keccak256(utf8(checkoutSession.id))` |
| `paymentId` | `merchantId` and `orderId` | `keccak256(abi.encode(merchantId, orderId))` |

The onchain `orderId` is the hash of the **checkout session id**, not of your own `orderId`. One checkout session pays exactly one order, and because the contract allows one payment per `paymentId`, a session can't be paid twice.

You rarely need to compute these yourself:

- The checkout session object (including the public `GET /api/v1/checkout_sessions/:id`) returns `chainMerchantId` and `chainOrderId`. See the [API reference](./api-reference.md).
- The payment object, in the API and in webhooks, returns `chainPaymentId`.

To derive them with viem (this mirrors `packages/core/src/ids.ts`):

```ts
import { encodeAbiParameters, keccak256, toBytes, type Hex } from "viem";

const chainMerchantId = (merchantId: string): Hex => keccak256(toBytes(merchantId));
const chainOrderId = (sessionId: string): Hex => keccak256(toBytes(sessionId));
const chainPaymentId = (merchantId: Hex, orderId: Hex): Hex =>
  keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }], [merchantId, orderId]));

// Values from the first live testnet run:
const merchantId = chainMerchantId("mer_ZzAU0GqUZD5iZuhbP7Af");
// 0xeb1a564a0d25499a0f1db5e4121f95eb0a3bf795babee2b0d6063f5d6a4b9e0b
const orderId = chainOrderId("cs_fQqtlPuXFH5iqScwzpnm");
// 0xbcf4a0921c17cf58ebef2b225194ddbfb72dae472b365f693cc86fcf27e34c53
const paymentId = chainPaymentId(merchantId, orderId);
// 0xf023343c687ea8a44a45aa484624ae2da28c009014941a13a4982ce083da4993
```

The contract exposes the same calculation as `paymentIdOf(merchantId, orderId)`.

With Foundry's `cast`:

```bash
cast keccak "cs_fQqtlPuXFH5iqScwzpnm"
cast keccak "$(cast abi-encode 'f(bytes32,bytes32)' \
  0xeb1a564a0d25499a0f1db5e4121f95eb0a3bf795babee2b0d6063f5d6a4b9e0b \
  0xbcf4a0921c17cf58ebef2b225194ddbfb72dae472b365f693cc86fcf27e34c53)"
```

## Functions

### `pay`

```solidity
function pay(bytes32 merchantId, bytes32 orderId, uint256 amount) external nonReentrant returns (bytes32 paymentId)
```

Pays `amount` USDT, in base units (6 decimals, so `5980000` is 5.98 USDT), for the given merchant and order. The caller must have approved the router for at least `amount`. The USDT moves from `msg.sender` to the merchant's registered payout wallet, and the call emits `PaymentSettled`.

Reverts with:

- `MerchantNotRegistered(merchantId)` if the merchant has no payout wallet.
- `ZeroAmount()` if `amount` is 0.
- `AlreadyPaid(paymentId)` if this `(merchantId, orderId)` pair has already been paid.
- The token's own error if the transfer fails. The Whitechain Sepolia USDT reverts with a reason string: `ERC20: transfer amount exceeds balance` when the payer's balance is too low, and `ERC20: transfer amount exceeds allowance` when the approval is too low. If both are too low, you get the balance error.

Anyone can call `pay` for any registered merchant. The contract doesn't know about checkout sessions or prices; that check happens off-chain in the [settlement checks](#settlement-checks).

### `refund`

```solidity
function refund(bytes32 paymentId, uint256 amount) external nonReentrant
```

Refunds part or all of a payment to its original payer. Only the merchant's **current** payout wallet can call it, and that wallet must have approved the router for at least `amount`. The USDT moves from the payout wallet to the payer, and the call emits `Refunded`. Call it several times for several partial refunds; the total can never exceed the original amount.

Reverts with:

- `PaymentNotFound(paymentId)` if there is no such payment.
- `NotPayout(caller, payout)` if `msg.sender` is not the merchant's current payout wallet.
- `ZeroAmount()` if `amount` is 0.
- `RefundExceedsPayment(requested, refundable)` if `amount` is more than `amount - refunded` for the payment.
- The token's own error if the transfer fails, for example `ERC20: transfer amount exceeds allowance` when the payout wallet hasn't approved the router for `amount`.

If you change your payout wallet, refunds for older payments must be signed by the new wallet.

### `registerMerchant`

```solidity
function registerMerchant(bytes32 merchantId, address payout) external onlyOwner
```

Registers a merchant or changes its payout wallet, and emits `MerchantRegistered`. Only the owner (the platform's backend signer) can call it. The dashboard calls it when you add or change your payout wallet. Reverts with `ZeroAddress()` if `payout` is the zero address, and `OwnableUnauthorizedAccount(caller)` if the caller isn't the owner.

### Read functions

```solidity
function getPayment(bytes32 paymentId) external view returns (Payment memory)
function merchantPayout(bytes32 merchantId) external view returns (address)
function paymentIdOf(bytes32 merchantId, bytes32 orderId) public pure returns (bytes32)
IERC20 public immutable usdt; // getter: function usdt() external view returns (address)
```

`getPayment` returns this struct:

```solidity
struct Payment {
    bytes32 merchantId;
    bytes32 orderId;
    address payer;
    uint256 amount;   // base units paid
    uint256 refunded; // base units refunded so far
}
```

For an unknown `paymentId`, `getPayment` does not revert. It returns a zeroed struct, so check that `payer` is not the zero address. `merchantPayout` returns the zero address for an unregistered merchant.

### Inherited from OpenZeppelin `Ownable`

```solidity
function owner() public view returns (address)
function transferOwnership(address newOwner) public onlyOwner
function renounceOwnership() public onlyOwner
```

Apart from transferring or renouncing ownership itself, the owner's only power in this contract is `registerMerchant`.

### Constructor

```solidity
constructor(address usdt_, address owner_)
```

Reverts with `ZeroAddress()` if `usdt_` is the zero address, and `OwnableInvalidOwner(address(0))` if `owner_` is.

## Events

```solidity
event MerchantRegistered(bytes32 indexed merchantId, address payout);

event PaymentSettled(
    bytes32 indexed paymentId,
    bytes32 indexed merchantId,
    bytes32 indexed orderId,
    address payer,
    address payout,
    address token,
    uint256 amount
);

event Refunded(bytes32 indexed paymentId, address indexed payer, uint256 amount, uint256 totalRefunded);

// inherited from Ownable
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

| Event | topic0 |
| --- | --- |
| `MerchantRegistered` | `0x1108b573acb7954c6be9806cc3a17ed5864f50fa96ad4cbc9cd82fa63d42b9f7` |
| `PaymentSettled` | `0x3fdc1d05dfa723b79de4307baf18ae87604c0fedbffec3b67e00a7b8c9f52339` |
| `Refunded` | `0xd906944adfb7859a98917af9d79763e627ff23f5d2448a7c197f3cb1a927f40a` |

`PaymentSettled.payout` is the wallet that received the funds at the time of payment. `Refunded.amount` is this refund; `Refunded.totalRefunded` is the running total for the payment after it.

## Errors

| Error | Selector | Raised by | Meaning |
| --- | --- | --- | --- |
| `ZeroAddress()` | `0xd92e233d` | constructor, `registerMerchant` | A required address is the zero address. |
| `ZeroAmount()` | `0x1f2a2005` | `pay`, `refund` | `amount` is 0. |
| `MerchantNotRegistered(bytes32 merchantId)` | `0xcd37aa72` | `pay` | No payout wallet is registered for the merchant. |
| `AlreadyPaid(bytes32 paymentId)` | `0xf4b76a0e` | `pay` | This merchant and order have already been paid. |
| `PaymentNotFound(bytes32 paymentId)` | `0x272f9fc1` | `refund` | No payment with this id. |
| `NotPayout(address caller, address payout)` | `0x7fb966d8` | `refund` | The caller isn't the merchant's current payout wallet. |
| `RefundExceedsPayment(uint256 requested, uint256 refundable)` | `0x333d1b2c` | `refund` | The refund is larger than what is left to refund. |

From OpenZeppelin:

| Error | Selector | Meaning |
| --- | --- | --- |
| `OwnableUnauthorizedAccount(address account)` | `0x118cdaa7` | A non-owner called `registerMerchant`, `transferOwnership` or `renounceOwnership`. |
| `OwnableInvalidOwner(address owner)` | `0x1e4fbdf7` | Zero address passed as owner. |
| `ReentrancyGuardReentrantCall()` | `0x3ee5aeb5` | Re-entry into `pay` or `refund`. |
| `SafeERC20FailedOperation(address token)` | `0x5274afe7` | The token returned `false` from `transferFrom`, or has no code. |

A `transferFrom` that reverts inside the token passes the token's own revert data through unchanged. The Whitechain Sepolia USDT uses reason strings (`Error(string)`), such as `ERC20: transfer amount exceeds balance` and `ERC20: transfer amount exceeds allowance`.

## Non-custodial guarantees

These follow from the contract code, which you can read in full in [`PaymentRouter.sol`](https://github.com/Sahil-Gulihar/ethglobal-mum/blob/main/contracts/src/PaymentRouter.sol):

- **It never holds funds.** `pay` transfers straight from the payer to the payout wallet, and `refund` straight from the payout wallet to the payer, each with a single `transferFrom`. The router's own USDT balance stays at zero. The fuzz test `testFuzz_routerNeverHoldsFunds` in [`contracts/test/PaymentRouter.t.sol`](https://github.com/Sahil-Gulihar/ethglobal-mum/blob/main/contracts/test/PaymentRouter.t.sol) checks this after every payment and refund.
- **There is no withdraw function.** Nothing in the contract can move tokens except `pay` and `refund`, and both only move tokens from the caller.
- **Refunds go to the original payer only.** The destination is the stored `payer`; the caller can't choose it.
- **Refunds are capped.** The total refunded can never exceed the amount paid.
- **One payment per order.** A second `pay` for the same `(merchantId, orderId)` reverts with `AlreadyPaid`.
- **Single token.** The USDT address is `immutable` and set at deploy time.
- **Not upgradeable.** It's a plain contract, not a proxy.

What you do trust the platform for:

- **The payout mapping.** The owner (`0xA8d1...9c12`) can change any merchant's payout wallet with `registerMerchant`. That would redirect future payments for that merchant, and the new wallet would control refunds. It can't touch payments that have already settled, because those funds are already in your wallet. The dashboard only calls `registerMerchant` when you add or change your payout wallet. You can watch for unexpected changes by filtering `MerchantRegistered` on your `merchantId`.
- **Order bookkeeping.** Whether a payment counts as paying your checkout session is decided off-chain by the indexer. See [settlement checks](#settlement-checks).

## Verify a payment onchain

You don't have to take the platform's word for a payment. With the `chainPaymentId` and `txHash` from a [`payment.succeeded`](./webhooks.md) event or from `GET /api/v1/payments/:id`, read the contract directly.

### Read `getPayment`

This reads the payment's current state from contract storage, including refunds so far:

```ts
import { createPublicClient, defineChain, formatUnits, http, parseAbi, parseEventLogs, type Hex } from "viem";

const whitechainSepolia = defineChain({
  id: 1874,
  name: "Whitechain Sepolia",
  nativeCurrency: { name: "WhiteBIT Coin", symbol: "WBT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.whitechain.io"] } },
  blockExplorers: { default: { name: "Whitechain Explorer", url: "https://explorer.testnet.whitechain.io" } },
  testnet: true,
});

const ROUTER = "0xa99a6D97607567f4fe734831910D24f4e9BD0508";
const USDT = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7";

const routerAbi = parseAbi([
  "function getPayment(bytes32 paymentId) view returns ((bytes32 merchantId, bytes32 orderId, address payer, uint256 amount, uint256 refunded))",
  "event PaymentSettled(bytes32 indexed paymentId, bytes32 indexed merchantId, bytes32 indexed orderId, address payer, address payout, address token, uint256 amount)",
]);

const client = createPublicClient({ chain: whitechainSepolia, transport: http() });

// From a payment.succeeded webhook (or GET /api/v1/payments/:id).
const chainPaymentId: Hex = "0xf023343c687ea8a44a45aa484624ae2da28c009014941a13a4982ce083da4993";
const txHash: Hex = "0xebd1c99ae548a3e497084f92a3d41d1bb0a8a5f4b775a681ebccd715e3e05125";

// 1. Current state of the payment, straight from contract storage.
const p = await client.readContract({ address: ROUTER, abi: routerAbi, functionName: "getPayment", args: [chainPaymentId] });
if (p.payer === "0x0000000000000000000000000000000000000000") throw new Error("No such payment onchain");
console.log(`paid ${formatUnits(p.amount, 6)} USDT, refunded ${formatUnits(p.refunded, 6)} USDT, payer ${p.payer}`);
// paid 5.98 USDT, refunded 2 USDT, payer 0xd25e2d037A49F19EAe6d55396fa52f2D95B7f27e

// 2. The PaymentSettled event in the payment transaction.
const receipt = await client.getTransactionReceipt({ hash: txHash });
const [settled] = parseEventLogs({ abi: routerAbi, eventName: "PaymentSettled", logs: receipt.logs }).filter(
  (l) => l.address.toLowerCase() === ROUTER.toLowerCase(),
);
console.log(receipt.status, settled.args.paymentId === chainPaymentId, settled.args.token === USDT, settled.args.payout);
// success true true 0xA8d17110550f389801470A0088e423C72C5A9c12
```

Always check that the log came from the router address. Any contract can emit an event with the same signature.

The same read with `cast`:

```bash
cast call 0xa99a6D97607567f4fe734831910D24f4e9BD0508 \
  "getPayment(bytes32)((bytes32,bytes32,address,uint256,uint256))" \
  0xf023343c687ea8a44a45aa484624ae2da28c009014941a13a4982ce083da4993 \
  --rpc-url https://rpc.testnet.whitechain.io
```

### Filter `PaymentSettled` and `Refunded`

All three ids in `PaymentSettled` are indexed, so you can filter by payment, merchant or order. This finds every payment and refund for one `paymentId`, reusing `client` and `ROUTER` from above:

```ts
import { parseAbiItem } from "viem";

const paymentSettled = parseAbiItem(
  "event PaymentSettled(bytes32 indexed paymentId, bytes32 indexed merchantId, bytes32 indexed orderId, address payer, address payout, address token, uint256 amount)",
);
const refunded = parseAbiItem("event Refunded(bytes32 indexed paymentId, address indexed payer, uint256 amount, uint256 totalRefunded)");

const DEPLOY_BLOCK = 12373441n; // router deploy block
const CHUNK = 2000n; // the public RPC allows at most 10,000 blocks per eth_getLogs call

const head = await client.getBlockNumber();
const payments = [];
const refunds = [];
for (let from = DEPLOY_BLOCK; from <= head; from += CHUNK) {
  const to = from + CHUNK - 1n < head ? from + CHUNK - 1n : head;
  const range = { address: ROUTER, args: { paymentId: chainPaymentId }, fromBlock: from, toBlock: to } as const;
  payments.push(...(await client.getLogs({ ...range, event: paymentSettled })));
  refunds.push(...(await client.getLogs({ ...range, event: refunded })));
}
console.log(payments.length, refunds.length);
// 1 1 (the live-run payment and its 2.00 USDT refund)
```

To list all of your payments, filter on `args: { merchantId }` instead. The public RPC rejects a range wider than 10,000 blocks (`query exceeds max block range 10000`) and a `toBlock` beyond the current head, so read the head first and query in chunks. The platform's indexer uses 2,000 blocks per request.

You can also open the transaction on the [explorer](https://explorer.testnet.whitechain.io) and look at its logs. The contract is verified there, so the explorer decodes them by name.

## Settlement checks

`PaymentSettled` proves money moved, but not that it paid the right checkout session for the right price. Before marking an order paid, the indexer checks every `PaymentSettled` log against the database: chain id, router address, token, the `paymentId` formula, the session and merchant ids, the exact amount, the token decimals and the receipt status, with 1 block confirmation. The same code runs in the background indexer and when the checkout widget submits a transaction hash, so a submitted hash is never trusted on its own. The full ordered list, and what happens when a check fails, is in [Payments: settlement checks](./payments.md#settlement-checks).

A `PaymentSettled` that fails a check is skipped and logged. The USDT has still moved to your payout wallet, because the contract already sent it there; it just isn't linked to a checkout session. See [Payments: wrong amounts](./payments.md#wrong-amounts).

`Refunded` logs are checked the same way and then matched to pending refund requests. See [Refunds: how onchain refunds are matched](./refunds.md#how-onchain-refunds-are-matched).

## Related

- [Webhooks](./webhooks.md): the events sent after these checks pass
- [Refunds](./refunds.md): requesting and signing refunds from the dashboard
- [Payments](./payments.md): the payment object
- [DEPLOYMENTS.md](../DEPLOYMENTS.md): deploy details and how to redeploy
