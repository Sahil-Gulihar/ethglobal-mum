# Whitechain Commerce contracts

`PaymentRouter` is a non-custodial USDT checkout router for Whitechain Sepolia (chain 1874).
It must match the frozen ABI in `packages/core/src/abi.ts` (see `docs/INTERFACES.md`).
Deployment details live in `docs/DEPLOYMENTS.md`.

## Setup (clean clone)

Dependencies (OpenZeppelin Contracts v5.7.0, forge-std v1.17.0) are fetched by a pinned script
rather than committed or added as git submodules:

```bash
export PATH="$HOME/.foundry/bin:$PATH"
bash contracts/install-deps.sh && cd contracts && forge build
```

## Test

```bash
cd contracts && forge test                       # unit tests; the fork test is skipped
set -a && . ../.env && set +a && forge test -vv  # also runs the fork test against chain 1874 (WHITECHAIN_RPC_URL)
```

## Deploy (Whitechain Sepolia)

```bash
cd contracts && set -a && . ../.env && set +a
forge script script/Deploy.s.sol:Deploy --rpc-url "$WHITECHAIN_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast
```

The constructor gets the official USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`, and the deployer becomes the owner.

## Verify (Blockscout)

```bash
forge verify-contract <address> src/PaymentRouter.sol:PaymentRouter \
  --rpc-url https://rpc.testnet.whitechain.io/ \
  --verifier blockscout --verifier-url https://explorer.testnet.whitechain.io/api/ \
  --constructor-args $(cast abi-encode "constructor(address,address)" 0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7 <owner>)
```
