// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Whitechain Commerce PaymentRouter
/// @notice Non-custodial USDT checkout router. Every payment moves straight from the payer to the
///         merchant's payout wallet and emits an event linked to the order. Refunds move straight
///         from the merchant's current payout wallet back to the original payer. The router never
///         holds a token balance.
contract PaymentRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Payment {
        bytes32 merchantId;
        bytes32 orderId;
        address payer;
        uint256 amount;
        uint256 refunded;
    }

    /// @notice The only token this router settles in (official Whitechain Sepolia USDT).
    IERC20 public immutable usdt;

    mapping(bytes32 merchantId => address payout) private _payouts;
    mapping(bytes32 paymentId => Payment) private _payments;

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

    error ZeroAddress();
    error ZeroAmount();
    error MerchantNotRegistered(bytes32 merchantId);
    error AlreadyPaid(bytes32 paymentId);
    error PaymentNotFound(bytes32 paymentId);
    error NotPayout(address caller, address payout);
    error RefundExceedsPayment(uint256 requested, uint256 refundable);

    constructor(address usdt_, address owner_) Ownable(owner_) {
        if (usdt_ == address(0)) revert ZeroAddress();
        usdt = IERC20(usdt_);
    }

    /// @notice Register a merchant or update its payout wallet. Backend signer only.
    function registerMerchant(bytes32 merchantId, address payout) external onlyOwner {
        if (payout == address(0)) revert ZeroAddress();
        _payouts[merchantId] = payout;
        emit MerchantRegistered(merchantId, payout);
    }

    function merchantPayout(bytes32 merchantId) external view returns (address) {
        return _payouts[merchantId];
    }

    /// @notice Pay `amount` USDT (base units) for (merchantId, orderId). Caller must have approved the router.
    function pay(bytes32 merchantId, bytes32 orderId, uint256 amount) external nonReentrant returns (bytes32 paymentId) {
        address payout = _payouts[merchantId];
        if (payout == address(0)) revert MerchantNotRegistered(merchantId);
        if (amount == 0) revert ZeroAmount();

        paymentId = paymentIdOf(merchantId, orderId);
        Payment storage p = _payments[paymentId];
        if (p.payer != address(0)) revert AlreadyPaid(paymentId);

        p.merchantId = merchantId;
        p.orderId = orderId;
        p.payer = msg.sender;
        p.amount = amount;

        usdt.safeTransferFrom(msg.sender, payout, amount);

        emit PaymentSettled(paymentId, merchantId, orderId, msg.sender, payout, address(usdt), amount);
    }

    /// @notice Refund part or all of a payment to its payer. Only the merchant's CURRENT payout wallet can
    ///         call this, and it must have approved the router for `amount`.
    function refund(bytes32 paymentId, uint256 amount) external nonReentrant {
        Payment storage p = _payments[paymentId];
        if (p.payer == address(0)) revert PaymentNotFound(paymentId);
        address payout = _payouts[p.merchantId];
        if (msg.sender != payout) revert NotPayout(msg.sender, payout);
        if (amount == 0) revert ZeroAmount();
        uint256 refundable = p.amount - p.refunded;
        if (amount > refundable) revert RefundExceedsPayment(amount, refundable);

        uint256 total = p.refunded + amount;
        p.refunded = total;

        usdt.safeTransferFrom(payout, p.payer, amount);

        emit Refunded(paymentId, p.payer, amount, total);
    }

    function getPayment(bytes32 paymentId) external view returns (Payment memory) {
        return _payments[paymentId];
    }

    function paymentIdOf(bytes32 merchantId, bytes32 orderId) public pure returns (bytes32) {
        return keccak256(abi.encode(merchantId, orderId));
    }
}
