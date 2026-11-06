# Deployments

## Whitechain Sepolia (chain 1874, `0x752`)

| | |
|---|---|
| PaymentRouter | [`0xa99a6D97607567f4fe734831910D24f4e9BD0508`](https://explorer.testnet.whitechain.io/address/0xa99a6D97607567f4fe734831910D24f4e9BD0508) |
| Deploy tx | [`0x1d2827bfed5817deafb63df7d6c381fcbaed0d79ad4abfdede4fa9ea55c38b37`](https://explorer.testnet.whitechain.io/tx/0x1d2827bfed5817deafb63df7d6c381fcbaed0d79ad4abfdede4fa9ea55c38b37) |
| Deploy block | `12373441` (use as the indexer start block) |
| Owner (backend signer) | [`0xA8d17110550f389801470A0088e423C72C5A9c12`](https://explorer.testnet.whitechain.io/address/0xA8d17110550f389801470A0088e423C72C5A9c12) |
| USDT (constructor arg, 6 decimals) | [`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`](https://explorer.testnet.whitechain.io/token/0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7) |
| Compiler | solc 0.8.30, optimizer 200 runs, evm `prague`, OpenZeppelin Contracts v5.7.0 |
| Broadcast | `contracts/broadcast/Deploy.s.sol/1874/run-latest.json` |
| Public RPC | `https://rpc.testnet.whitechain.io` (official, keyless, CORS `*`, `eth_chainId` = `0x752`) |
| Explorer | https://explorer.testnet.whitechain.io (Blockscout) |

Sanity checks after the deploy: `usdt()` returns `0xcedfB561...55a7` and `owner()` returns `0xA8d1...9c12`.

These values are set in `packages/core/src/deployment.ts` and in the root `.env` (`PAYMENT_ROUTER_ADDRESS`,
`NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS`, `NEXT_PUBLIC_WHITECHAIN_RPC_URL`).

Do not use `https://rpc-testnet.whitechain.io` (with a hyphen). It returns chainId 2625, which is a different network.

### Verification status

- **Sourcify: verified, exact match** (creation and runtime).
  https://sourcify.dev/server/v2/contract/1874/0xa99a6D97607567f4fe734831910D24f4e9BD0508
- **Blockscout: not verified yet.** The verifier service returns `{"message":"Contract verification is temporarily unavailable."}`
  on every endpoint we tried: forge `--verifier blockscout`, `/api/v2/.../verification/via/standard-input`, and the
  standalone `forge verify-contract`. In `/api/v2/smart-contracts/verification/config`, `solidity_compiler_versions` is empty,
  so the problem is on the server side. To retry once it's back, run:

  ```bash
  cd contracts && forge verify-contract 0xa99a6D97607567f4fe734831910D24f4e9BD0508 src/PaymentRouter.sol:PaymentRouter \
    --rpc-url https://rpc.testnet.whitechain.io/ \
    --verifier blockscout --verifier-url https://explorer.testnet.whitechain.io/api/ \
    --constructor-args $(cast abi-encode "constructor(address,address)" \
      0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7 0xA8d17110550f389801470A0088e423C72C5A9c12) --watch
  ```

  Another option is the explorer's "Verify & Publish" page with the "Sourcify" method, which imports the existing Sourcify match.

### Redeploy

```bash
export PATH="$HOME/.foundry/bin:$PATH"
bash contracts/install-deps.sh
cd contracts && set -a && . ../.env && set +a
forge test
forge script script/Deploy.s.sol:Deploy --rpc-url https://rpc.testnet.whitechain.io/ \
  --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast \
  --verify --verifier blockscout --verifier-url https://explorer.testnet.whitechain.io/api/
```

If the Ankr `WHITECHAIN_RPC_URL` times out during broadcast (this happened during the first attempt), use the public RPC as shown above.
After a redeploy:

1. Update `PAYMENT_ROUTER_ADDRESS` and `PAYMENT_ROUTER_DEPLOY_BLOCK` in `packages/core/src/deployment.ts`.
2. Update both router env vars in `.env`.
3. Update this file.
4. Commit `contracts/broadcast/Deploy.s.sol/1874/run-latest.json`.
5. Register merchants again on the new router: payout mappings don't carry over.
