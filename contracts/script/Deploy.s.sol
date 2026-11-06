// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {PaymentRouter} from "../src/PaymentRouter.sol";

/// Deploys PaymentRouter with the official Whitechain Sepolia USDT and the deployer as owner.
///   forge script script/Deploy.s.sol:Deploy --rpc-url "$WHITECHAIN_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast
contract Deploy is Script {
    address constant USDT = 0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7;

    function run() external returns (PaymentRouter router) {
        require(block.chainid == 1874, "not Whitechain Sepolia (1874)");
        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();
        router = new PaymentRouter(USDT, deployer);
        vm.stopBroadcast();
        console2.log("PaymentRouter:", address(router));
        console2.log("owner:", router.owner());
    }
}
