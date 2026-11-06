# Whitechain feedback

We built Whitechain Commerce, a non-custodial USDT checkout on Whitechain Sepolia (chain 1874).

## What worked
- Deploying with Foundry was straightforward (solc 0.8.30, `evm_version = "prague"` as the docs suggest).
- Forking chain 1874 with anvil let us test the whole flow against the real USDT before spending anything.
- The public RPC `https://rpc.testnet.whitechain.io` needs no key and works from the browser.
- Sourcify verification worked first try.

## Where we got stuck
- **No testnet USDT faucet.** The faucet only gives WBT, but the prize needs a payment in the official USDT. We had to work out that we could swap WBT for USDT in the YetiTrade testnet pool.
- **Explorer verification was down for hours.** Blockscout returned "Contract verification is temporarily unavailable" on every method we tried. It came back later that day and verified fine; Sourcify worked the whole time.
- **Confusing RPC hostname.** `rpc-testnet.whitechain.io` (hyphen) is chain 2625, not 1874. The right one is `rpc.testnet.whitechain.io` (dot).
- The Ankr link on the prize page goes to a signup page, and the Ankr RPC timed out once during a deploy.

## What the docs were missing
- How to get testnet USDT.
- One table with the chain id, RPC, explorer, faucet and verifier URL for Sepolia.
- USDT token details: 6 decimals, and support for `permit` (EIP-2612) and EIP-3009.
