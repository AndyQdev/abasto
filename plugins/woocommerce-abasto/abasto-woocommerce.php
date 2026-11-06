<?php
/**
 * Plugin Name: Abasto para WooCommerce
 * Description: Conecta tu tienda con Abasto: importa el catálogo de tu mayorista y le manda tus pedidos, sin duplicarlos.
 * Version: 1.0.0
 * Requires at least: 6.4
 * Requires PHP: 8.1
 * Requires Plugins: woocommerce
 * WC requires at least: 8.0
 * Author: Abasto
 * Text Domain: abasto-woocommerce
 */

if (!defined('ABSPATH')) {
	exit;
}

require_once __DIR__ . '/includes/logica.php';

add_action('before_woocommerce_init', static function (): void {
	// Compatible con el almacenamiento nuevo de pedidos de WooCommerce (HPOS)
	if (class_exists(\Automattic\WooCommerce\Utilities\FeaturesUtil::class)) {
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
	}
});

add_action('plugins_loaded', static function (): void {
	if (!class_exists('WooCommerce')) {
		add_action('admin_notices', static function (): void {
			echo '<div class="notice notice-error"><p>Abasto necesita que WooCommerce esté activo.</p></div>';
		});
		return;
	}
	require_once __DIR__ . '/includes/class-cliente.php';
	require_once __DIR__ . '/includes/class-pedidos.php';
	require_once __DIR__ . '/includes/class-avisos.php';
	require_once __DIR__ . '/includes/class-importador.php';
	require_once __DIR__ . '/includes/class-ajustes.php';

	$cliente = new Abasto_Cliente();
	new Abasto_Pedidos($cliente);
	new Abasto_Avisos();
	if (is_admin()) {
		new Abasto_Ajustes($cliente, new Abasto_Importador($cliente));
	}
	if (defined('WP_CLI') && WP_CLI) {
		// Para importar desde la consola, igual que el botón de la pantalla
		WP_CLI::add_command('abasto importar', static function (array $args, array $opciones) use ($cliente): void {
			$r = (new Abasto_Importador($cliente))->importar((string) ($args[0] ?? ''), (string) ($opciones['busqueda'] ?? ''), (float) get_option('abasto_margen', 20));
			if ($r['error']) {
				WP_CLI::error((string) $r['error']);
			}
			WP_CLI::success(sprintf('%d nuevos, %d actualizados, %d sin precio', $r['creados'], $r['actualizados'], $r['sin_precio']));
		});
	}
});
