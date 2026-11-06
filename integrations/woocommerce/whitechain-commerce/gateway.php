<?php

namespace WhitechainCommerce;

defined('ABSPATH') || exit;

final class Gateway extends \WC_Payment_Gateway {
    public function __construct() {
        $this->id = METHOD;
        $this->method_title = 'Whitechain Commerce';
        $this->method_description = 'Testnet only. USD orders are charged at 1 USDT per USD.';
        $this->has_fields = false;
        $this->supports = ['products'];
        $this->init_form_fields();
        $this->init_settings();
        $this->enabled = $this->get_option('enabled');
        $this->title = $this->get_option('title');
        $this->description = 'Pay with testnet USDT on Whitechain.';
        add_action('woocommerce_update_options_payment_gateways_' . $this->id, [$this, 'process_admin_options']);
    }

    public function init_form_fields() {
        $this->form_fields = [
            'enabled' => ['title' => 'Enable testnet gateway', 'type' => 'checkbox', 'default' => 'no'],
            'title' => ['title' => 'Checkout label', 'type' => 'text', 'default' => 'Pay with USDT (testnet)'],
            'api_key' => ['title' => 'Whitechain test API key', 'type' => 'password'],
            'webhook_secret' => [
                'title' => 'Whitechain webhook signing secret',
                'type' => 'password',
                'description' => esc_html(rest_url('whitechain-commerce/v1/webhook')),
            ],
        ];
    }

    public function is_available() {
        return parent::is_available() && get_woocommerce_currency() === 'USD'
            && str_starts_with((string) $this->get_option('api_key'), 'sk_test_')
            && $this->get_option('webhook_secret') !== '';
    }

    public function process_payment($order_id) {
        try {
            $url = with_order_lock((int) $order_id, function () use ($order_id) {
                $order = wc_get_order($order_id);
                $amount = $order ? $order->get_total() : '';
                $units = units($amount);
                if (!$this->is_available() || !$order || !$order->needs_payment()
                    || $order->get_payment_method() !== METHOD || $order->get_currency() !== 'USD' || $units === null) {
                    throw new \RuntimeException('Order is ineligible.');
                }

                $origin = defined('WHITECHAIN_API_ORIGIN') ? rtrim(WHITECHAIN_API_ORIGIN, '/') : 'https://100lana.com';
                $checkout_origin = defined('WHITECHAIN_CHECKOUT_ORIGIN') ? rtrim(WHITECHAIN_CHECKOUT_ORIGIN, '/') : $origin;
                $session = $order->get_meta('_whitechain_session');
                if ($session) {
                    if ($session['units'] !== $units || !str_starts_with($session['url'], $checkout_origin . '/checkout/')) {
                        throw new \RuntimeException('Order terms changed.');
                    }
                    return $session['url'];
                }

                $response = wp_remote_post($origin . '/api/v1/checkout_sessions', [
                    'timeout' => 10,
                    'redirection' => 0,
                    'headers' => ['Authorization' => 'Bearer ' . $this->get_option('api_key'), 'Content-Type' => 'application/json'],
                    'body' => wp_json_encode([
                        'orderId' => reference((int) $order_id),
                        'amount' => $amount,
                        'currency' => 'USDT',
                        'successUrl' => $this->get_return_url($order),
                        'cancelUrl' => $order->get_checkout_payment_url(),
                    ]),
                ]);
                $session = json_decode(wp_remote_retrieve_body($response), true);
                if (!in_array(wp_remote_retrieve_response_code($response), [200, 201], true)
                    || !is_string($session['id'] ?? null) || !preg_match('/^cs_[a-zA-Z0-9_]+$/D', $session['id'])
                    || ($session['url'] ?? '') !== $checkout_origin . '/checkout/' . $session['id']
                    || ($session['amountUnits'] ?? '') !== $units) {
                    throw new \RuntimeException('Invalid checkout session.');
                }

                $order->update_meta_data('_whitechain_session', ['id' => $session['id'], 'units' => $units, 'url' => $session['url']]);
                $order->save_meta_data();
                return $session['url'];
            });
            return ['result' => 'success', 'redirect' => $url];
        } catch (\Throwable $error) {
            wc_add_notice('Whitechain checkout is unavailable for this order.', 'error');
            return ['result' => 'failure'];
        }
    }
}
