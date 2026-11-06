<?php

namespace WhitechainCommerce;

defined('ABSPATH') || exit;

final class Blocks extends \Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType {
    protected $name = METHOD;
    private ?Gateway $gateway = null;

    public function initialize() {
        $this->gateway = WC()->payment_gateways()->payment_gateways()[METHOD] ?? null;
    }

    public function is_active() {
        return $this->gateway && $this->gateway->is_available();
    }

    public function get_payment_method_script_handles() {
        wp_register_script('whitechain-commerce-blocks', plugins_url('checkout.js', __FILE__), ['wc-blocks-registry', 'wc-settings', 'wp-element'], '0.1.0', true);
        return ['whitechain-commerce-blocks'];
    }

    public function get_payment_method_data() {
        return ['title' => $this->gateway->get_title(), 'description' => $this->gateway->get_description()];
    }
}
