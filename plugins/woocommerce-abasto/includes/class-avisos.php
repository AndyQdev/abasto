<?php
if (!defined('ABSPATH')) {
	exit;
}

/** Recibe los avisos firmados de Abasto y deja una nota en el pedido de WooCommerce al que corresponden. */
final class Abasto_Avisos
{
	public function __construct()
	{
		add_action('rest_api_init', [$this, 'registrar_ruta']);
	}

	public static function direccion(): string
	{
		return rest_url('abasto/v1/avisos');
	}

	public function registrar_ruta(): void
	{
		register_rest_route('abasto/v1', '/avisos', [
			'methods' => 'POST',
			// La autenticación es la firma: la revisa recibir() con el cuerpo tal como llegó
			'permission_callback' => '__return_true',
			'callback' => [$this, 'recibir'],
		]);
	}

	public function recibir(WP_REST_Request $peticion): WP_REST_Response
	{
		$cuerpo = (string) $peticion->get_body();
		$valida = abasto_firma_valida(
			(string) get_option('abasto_secreto_avisos', ''),
			(string) $peticion->get_header('x-abasto-fecha'),
			$cuerpo,
			(string) $peticion->get_header('x-abasto-firma'),
			time()
		);
		if (!$valida) {
			return new WP_REST_Response(['mensaje' => 'Firma inválida'], 401);
		}

		// Abasto entrega al menos una vez: lo repetido se descarta
		$entrega = (string) $peticion->get_header('x-abasto-entrega');
		$marca = 'abasto_aviso_' . md5($entrega);
		if ($entrega !== '' && get_transient($marca)) {
			return new WP_REST_Response(['estado' => 'repetido'], 200);
		}

		$aviso = json_decode($cuerpo, true);
		$tipo = is_array($aviso) ? (string) ($aviso['tipo'] ?? '') : '';
		$datos = is_array($aviso) && is_array($aviso['datos'] ?? null) ? $aviso['datos'] : [];
		$nota = abasto_nota_de_evento($tipo, $datos);
		$pedido = $this->pedido_de_abasto((string) ($datos['pedidoId'] ?? ''));
		if ($nota !== null && $pedido) {
			$pedido->add_order_note($nota);
		}
		if ($entrega !== '') {
			set_transient($marca, 1, DAY_IN_SECONDS);
		}
		return new WP_REST_Response(['estado' => 'recibido'], 200);
	}

	/** El pedido de WooCommerce que mandó ese pedido de Abasto. */
	private function pedido_de_abasto(string $pedido_abasto): ?WC_Order
	{
		if ($pedido_abasto === '') {
			return null;
		}
		$encontrados = wc_get_orders([
			'limit' => 1,
			'meta_query' => [['key' => '_abasto_pedidos', 'value' => '"' . $pedido_abasto . '"', 'compare' => 'LIKE']],
		]);
		return $encontrados[0] ?? null;
	}
}
