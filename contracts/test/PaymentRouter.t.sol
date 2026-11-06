// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PaymentRouter} from "../src/PaymentRouter.sol";

contract MockUSDT is ERC20 {
    constructor() ERC20("Tether USD", "USDT") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

interface IERC20Decimals {
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
}

contract PaymentRouterTest is Test {
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

    MockUSDT usdt;
    PaymentRouter router;

    address owner = makeAddr("owner");
    address payout = makeAddr("payout");
    address payout2 = makeAddr("payout2");
    address payer = makeAddr("payer");
    address stranger = makeAddr("stranger");

    bytes32 merchantId = keccak256("mer_test");
    bytes32 orderId = keccak256("cs_test");
    uint256 constant PRICE = 49_990_000; // 49.99 USDT

    function setUp() public {
        usdt = new MockUSDT();
        router = new PaymentRouter(address(usdt), owner);
        usdt.mint(payer, 1_000e6);
        vm.prank(payer);
        usdt.approve(address(router), type(uint256).max);
    }

    function _register() internal {
        vm.prank(owner);
        router.registerMerchant(merchantId, payout);
    }

    function _pay() internal returns (bytes32 pid) {
        _register();
        vm.prank(payer);
        pid = router.pay(merchantId, orderId, PRICE);
    }

    function _approveFromPayout(address who, uint256 amount) internal {
        vm.prank(who);
        usdt.approve(address(router), amount);
    }

    // ---- constructor / registration ----

    function test_constructor() public view {
        assertEq(address(router.usdt()), address(usdt));
        assertEq(router.owner(), owner);
    }

    function test_constructor_revertsOnZeroToken() public {
        vm.expectRevert(PaymentRouter.ZeroAddress.selector);
        new PaymentRouter(address(0), owner);
    }

    function test_register_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        router.registerMerchant(merchantId, payout);
        assertEq(router.merchantPayout(merchantId), address(0));
    }

    function test_register_emitsAndStores() public {
        vm.expectEmit(true, false, false, true, address(router));
        emit MerchantRegistered(merchantId, payout);
        _register();
        assertEq(router.merchantPayout(merchantId), payout);
    }

    function test_register_zeroPayoutReverts() public {
        vm.prank(owner);
        vm.expectRevert(PaymentRouter.ZeroAddress.selector);
        router.registerMerchant(merchantId, address(0));
    }

    // ---- pay ----

    function test_pay_happyPath() public {
        _register();
        bytes32 expected = keccak256(abi.encode(merchantId, orderId));
        assertEq(router.paymentIdOf(merchantId, orderId), expected);

        vm.expectEmit(true, true, true, true, address(router));
        emit PaymentSettled(expected, merchantId, orderId, payer, payout, address(usdt), PRICE);
        vm.prank(payer);
        bytes32 pid = router.pay(merchantId, orderId, PRICE);

        assertEq(pid, expected);
        assertEq(usdt.balanceOf(payout), PRICE);
        assertEq(usdt.balanceOf(payer), 1_000e6 - PRICE);
        assertEq(usdt.balanceOf(address(router)), 0);

        PaymentRouter.Payment memory p = router.getPayment(pid);
        assertEq(p.merchantId, merchantId);
        assertEq(p.orderId, orderId);
        assertEq(p.payer, payer);
        assertEq(p.amount, PRICE);
        assertEq(p.refunded, 0);
    }

    function test_pay_unregisteredReverts() public {
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.MerchantNotRegistered.selector, merchantId));
        router.pay(merchantId, orderId, PRICE);
    }

    function test_pay_zeroAmountReverts() public {
        _register();
        vm.prank(payer);
        vm.expectRevert(PaymentRouter.ZeroAmount.selector);
        router.pay(merchantId, orderId, 0);
    }

    function test_pay_doublePayReverts() public {
        bytes32 pid = _pay();
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.AlreadyPaid.selector, pid));
        router.pay(merchantId, orderId, PRICE);

        // A different payer cannot pay the same order either.
        usdt.mint(stranger, PRICE);
        vm.startPrank(stranger);
        usdt.approve(address(router), PRICE);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.AlreadyPaid.selector, pid));
        router.pay(merchantId, orderId, PRICE);
        vm.stopPrank();
    }

    function test_pay_insufficientAllowanceReverts() public {
        _register();
        vm.prank(payer);
        usdt.approve(address(router), PRICE - 1);
        vm.prank(payer);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(router), PRICE - 1, PRICE)
        );
        router.pay(merchantId, orderId, PRICE);
    }

    function test_pay_sameOrderDifferentMerchantIsDistinct() public {
        _pay();
        bytes32 otherMerchant = keccak256("mer_other");
        vm.prank(owner);
        router.registerMerchant(otherMerchant, payout2);
        vm.prank(payer);
        router.pay(otherMerchant, orderId, 1e6);
        assertEq(usdt.balanceOf(payout2), 1e6);
    }

    // ---- refund ----

    function test_refund_partialThenSecondPartial() public {
        bytes32 pid = _pay();
        _approveFromPayout(payout, PRICE);

        vm.expectEmit(true, true, false, true, address(router));
        emit Refunded(pid, payer, 10e6, 10e6);
        vm.prank(payout);
        router.refund(pid, 10e6);

        assertEq(router.getPayment(pid).refunded, 10e6);
        assertEq(usdt.balanceOf(payout), PRICE - 10e6);

        uint256 rest = PRICE - 10e6;
        vm.expectEmit(true, true, false, true, address(router));
        emit Refunded(pid, payer, rest, PRICE);
        vm.prank(payout);
        router.refund(pid, rest);

        assertEq(router.getPayment(pid).refunded, PRICE);
        assertEq(usdt.balanceOf(payout), 0);
        assertEq(usdt.balanceOf(payer), 1_000e6);
        assertEq(usdt.balanceOf(address(router)), 0);
    }

    function test_refund_overRefundReverts() public {
        bytes32 pid = _pay();
        _approveFromPayout(payout, type(uint256).max);

        vm.prank(payout);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.RefundExceedsPayment.selector, PRICE + 1, PRICE));
        router.refund(pid, PRICE + 1);

        vm.prank(payout);
        router.refund(pid, 40e6);
        vm.prank(payout);
        vm.expectRevert(
            abi.encodeWithSelector(PaymentRouter.RefundExceedsPayment.selector, PRICE - 40e6 + 1, PRICE - 40e6)
        );
        router.refund(pid, PRICE - 40e6 + 1);
    }

    function test_refund_zeroAmountReverts() public {
        bytes32 pid = _pay();
        vm.prank(payout);
        vm.expectRevert(PaymentRouter.ZeroAmount.selector);
        router.refund(pid, 0);
    }

    function test_refund_unknownPaymentReverts() public {
        bytes32 pid = keccak256("nope");
        vm.prank(payout);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.PaymentNotFound.selector, pid));
        router.refund(pid, 1);
    }

    function test_refund_byNonPayoutReverts() public {
        bytes32 pid = _pay();
        _approveFromPayout(payout, PRICE);
        address[3] memory callers = [stranger, payer, owner];
        for (uint256 i; i < callers.length; i++) {
            vm.prank(callers[i]);
            vm.expectRevert(abi.encodeWithSelector(PaymentRouter.NotPayout.selector, callers[i], payout));
            router.refund(pid, 1e6);
        }
    }

    function test_refund_withoutApprovalReverts() public {
        bytes32 pid = _pay();
        vm.prank(payout);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(router), 0, 1e6)
        );
        router.refund(pid, 1e6);
    }

    function test_payoutUpdate_thenRefundByNewPayout() public {
        bytes32 pid = _pay();

        vm.prank(owner);
        router.registerMerchant(merchantId, payout2);
        assertEq(router.merchantPayout(merchantId), payout2);

        // Old payout can no longer refund.
        _approveFromPayout(payout, PRICE);
        vm.prank(payout);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.NotPayout.selector, payout, payout2));
        router.refund(pid, 1e6);

        // New payout refunds from its own balance.
        usdt.mint(payout2, 5e6);
        _approveFromPayout(payout2, 5e6);
        vm.prank(payout2);
        router.refund(pid, 5e6);
        assertEq(usdt.balanceOf(payout2), 0);
        assertEq(router.getPayment(pid).refunded, 5e6);
        assertEq(usdt.balanceOf(address(router)), 0);
    }

    // ---- fuzz: router never holds funds, refunds bounded ----

    function testFuzz_routerNeverHoldsFunds(uint256 amount, uint256 r1, uint256 r2) public {
        amount = bound(amount, 1, 1_000e6);
        _register();
        vm.prank(payer);
        bytes32 pid = router.pay(merchantId, orderId, amount);
        assertEq(usdt.balanceOf(address(router)), 0);

        _approveFromPayout(payout, type(uint256).max);
        r1 = bound(r1, 1, amount);
        vm.prank(payout);
        router.refund(pid, r1);
        assertEq(usdt.balanceOf(address(router)), 0);

        r2 = bound(r2, 1, 2_000e6);
        vm.prank(payout);
        if (r1 + r2 > amount) {
            vm.expectRevert(abi.encodeWithSelector(PaymentRouter.RefundExceedsPayment.selector, r2, amount - r1));
            router.refund(pid, r2);
        } else {
            router.refund(pid, r2);
            assertEq(router.getPayment(pid).refunded, r1 + r2);
        }
        assertEq(usdt.balanceOf(address(router)), 0);
        assertLe(router.getPayment(pid).refunded, amount);
    }
}

/// Fork test against Whitechain Sepolia. Skipped unless WHITECHAIN_RPC_URL is set.
contract PaymentRouterForkTest is Test {
    address constant USDT = 0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7;

    function test_fork_realUsdt() public {
        string memory rpc = vm.envOr("WHITECHAIN_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        assertEq(block.chainid, 1874);
        assertEq(IERC20Decimals(USDT).decimals(), 6);
        assertEq(IERC20Decimals(USDT).symbol(), "USDT");

        address owner = makeAddr("owner");
        PaymentRouter router = new PaymentRouter(USDT, owner);
        assertEq(address(router.usdt()), USDT);

        // Exercise a payment against the real token using a dealt balance.
        bytes32 mid = keccak256("mer_fork");
        address payout = makeAddr("payout");
        address payer = makeAddr("payer");
        vm.prank(owner);
        router.registerMerchant(mid, payout);
        deal(USDT, payer, 5e6);
        vm.startPrank(payer);
        PaymentRouter.Payment memory before = router.getPayment(router.paymentIdOf(mid, keccak256("cs_fork")));
        assertEq(before.payer, address(0));
        (bool ok,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(router), 5e6));
        assertTrue(ok);
        router.pay(mid, keccak256("cs_fork"), 5e6);
        vm.stopPrank();
        assertEq(IERC20Decimals(USDT).decimals(), 6);
        (, bytes memory bal) = USDT.staticcall(abi.encodeWithSignature("balanceOf(address)", payout));
        assertEq(abi.decode(bal, (uint256)), 5e6);
        (, bytes memory rb) = USDT.staticcall(abi.encodeWithSignature("balanceOf(address)", address(router)));
        assertEq(abi.decode(rb, (uint256)), 0);
    }
}
