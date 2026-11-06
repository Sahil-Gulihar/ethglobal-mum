<?php
/**
 * Plugin Name: Whitechain Commerce
 * Description: Accept testnet USDT through Whitechain hosted checkout.
 * Version: 0.1.0
 * Requires PHP: 8.1
 * Requires Plugins: woocommerce
 */

namespace WhitechainCommerce;

defined('ABSPATH') || exit;

const METHOD = 'whitechain_commerce';

function reference(int $id): string {
    return 'woo_' . substr(hash('sha256', home_url('/')), 0, 24) . '_' . $id;
}

function units($amount): ?string {
    if (!is_string($amount) || strlen($amount) > 40 || !preg_match('/^(\d+)(?:\.(\d{1,6}))?$/D', $amount, $parts)) {
        return null;
    }
    return ltrim($parts[1] . str_pad($parts[2] ?? '', 6, '0'), '0') ?: null;
}

function with_order_lock(int $id, callable $operation) {
    global $wpdb;
    $lock = reference($id);
    if ('1' !== (string) $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 5)', $lock))) {
        throw new \RuntimeException('Order is busy.');
    }
    try {
        return $operation();
    } finally {
        $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock));
    }
}

add_action('before_woocommerce_init', static function () {
    if (class_exists(\Automattic\WooCommerce\Utilities\FeaturesUtil::class)) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
    }
});

add_action('plugins_loaded', static function () {
    if (!class_exists(\WC_Payment_Gateway::class)) {
        return;
    }
    require_once __DIR__ . '/gateway.php';
    add_filter('woocommerce_payment_gateways', static function ($gateways) {
        $gateways[] = Gateway::class;
        return $gateways;
    });
    add_action('rest_api_init', static function () {
        register_rest_route('whitechain-commerce/v1', '/webhook', [
            'methods' => 'POST',
            'callback' => __NAMESPACE__ . '\\webhook',
            'permission_callback' => '__return_true',
        ]);
    });
});

add_action('woocommerce_blocks_loaded', static function () {
    if (!class_exists(\Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType::class)) {
        return;
    }
    require_once __DIR__ . '/blocks.php';
    add_action('woocommerce_blocks_payment_method_type_registration', static function ($registry) {
        $registry->register(new Blocks());
    });
});

function webhook(\WP_REST_Request $request): \WP_REST_Response {
    $secret = get_option('woocommerce_' . METHOD . '_settings', [])['webhook_secret'] ?? '';
    $body = $request->get_body();
    if (!$secret || !preg_match('/^t=(\d{1,12}),v1=([a-f0-9]{64})$/D', $request->get_header('wc-signature'), $parts)
        || abs(time() - (int) $parts[1]) > 300
        || !hash_equals(hash_hmac('sha256', $parts[1] . '.' . $body, $secret), $parts[2])) {
        return new \WP_REST_Response(null, 401);
    }

    $event = json_decode($body, true);
    if (($event['type'] ?? '') !== 'payment.succeeded') {
        return new \WP_REST_Response(null, 204);
    }
    $payment = $event['data']['payment'] ?? [];
    $ref = $payment['orderId'] ?? '';
    if (!is_string($ref) || !preg_match('/^woo_[a-f0-9]{24}_(\d+)$/D', $ref, $match) || $ref !== reference((int) $match[1])) {
        return new \WP_REST_Response(null, 204);
    }

    $id = (int) $match[1];
    try {
        $status = with_order_lock($id, static function () use ($id, $payment) {
            $order = wc_get_order($id);
            if (!$order || $order->get_payment_method() !== METHOD) {
                return 409;
            }
            $session = $order->get_meta('_whitechain_session');
            $amount = units($payment['amount'] ?? null);
            $tx = $payment['txHash'] ?? '';
            if (!$session || ($payment['sessionId'] ?? '') !== $session['id']
                || ($payment['currency'] ?? '') !== 'USDT' || ($payment['chainId'] ?? 0) !== 1874
                || $order->get_currency() !== 'USD' || $amount === null || $amount !== $session['units']
                || $amount !== units($order->get_total())
                || !is_string($tx) || !preg_match('/^0x[a-fA-F0-9]{64}$/D', $tx)) {
                return 409;
            }
            if ($order->get_transaction_id() === $tx && $order->get_date_paid()) {
                return 204;
            }
            if (!$order->has_status(['pending', 'failed', 'on-hold']) || $order->get_date_paid()) {
                return 409;
            }
            return $order->payment_complete($tx) && $order->get_date_paid() ? 204 : 503;
        });
        return new \WP_REST_Response(null, $status);
    } catch (\Throwable $error) {
        return new \WP_REST_Response(null, 503);
    }
}
