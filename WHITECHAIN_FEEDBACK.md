# Whitechain developer feedback (DRAFT)

> **DRAFT.** Written from `docs/DEPLOYMENTS.md` and the git history. It still needs a human pass before submission.
> TODO(team): add your own notes below: time lost, what surprised you, anything from the faucet, the wallet or support.

Context: Whitechain Commerce, a non-custodial USDT checkout on Whitechain Sepolia (chain 1874). We deployed
`PaymentRouter` at `0xa99a6D97607567f4fe734831910D24f4e9BD0508` with Foundry.

## What worked well

- **Foundry deploys with `evm_version = "prague"`**, as the docs recommend: solc 0.8.30 with OpenZeppelin v5.7.0
  deployed cleanly, with no EVM-version surprises.
- **Anvil fork testing against 1874** (`anvil --fork-url ... --chain-id 1874`) with the real USDT and our deployed router
  worked very well. We ran the full browser checkout, indexer, webhooks and partial and full refunds with no real funds.
- **Sourcify verification** gave an exact match (creation and runtime) right away.
- The official public RPC `https://rpc.testnet.whitechain.io` is keyless and sends CORS `*`, so browser wallets and
  `wallet_addEthereumChain` just work.

## Where we got stuck

- **Blockscout verification was down.** Every endpoint returned
  `{"message":"Contract verification is temporarily unavailable."}`: forge `--verifier blockscout`,
  `/api/v2/.../verification/via/standard-input`, and `forge verify-contract`. In
  `/api/v2/smart-contracts/verification/config`, `solidity_compiler_versions` was empty,
  so the problem was on the server side.
- **RPC hostname confusion.** `https://rpc-testnet.whitechain.io` (hyphen) answers, but with chainId **2625**, not
  1874. It looks like the right URL and fails in confusing ways. We found the correct `https://rpc.testnet.whitechain.io`
  (dot) on the docs "connect wallet" page.
- **Ankr RPC timed out once** during a `forge script --broadcast`. Retrying against the public RPC worked. Also, the
  hackathon's Ankr link points to a signup page, not an RPC endpoint.

## Docs we were missing

- One table with the canonical chain id, RPC, explorer, faucet and verifier URL for Sepolia, and a warning about the
  2625 host.
- **USDT token facts:** 6 decimals, plus support for EIP-2612 `permit` and EIP-3009 (`transferWithAuthorization`).
  This matters for checkout UX (gasless approvals, one-click pay) and deserves a mention on the token page.
- A recommended way to verify contracts when Blockscout is down (for example, "verify on Sourcify, then import it in the explorer").
