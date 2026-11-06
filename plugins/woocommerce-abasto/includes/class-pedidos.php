<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * Cuando un pedido de WooCommerce queda pagado (o «en proceso» si es contra entrega), lo que vino de Abasto se le pide
 * a su mayorista. Si Abasto no responde, se reintenta solo; la clave fija hace que nunca entre dos veces.
 */
final class Abasto_Pedidos
{
	private const REINTENTOS = [300, 1800, 7200, 43200];

	public function __construct(private Abasto_Cliente $cliente)
	{
		add_action('woocommerce_order_status_processing', [$this, 'enviar']);
		add_action('woocommerce_order_status_completed', [$this, 'enviar']);
		add_action('abasto_reintentar_pedido', [$this, 'reintentar'], 10, 2);
	}

	public function reintentar(int $pedido_id, int $intento): void
	{
		$this->enviar($pedido_id, $intento);
	}

	public function enviar(int $pedido_id, int $intento = 0): void
	{
		$pedido = wc_get_order($pedido_id);
		if (!$pedido) {
			return;
		}
		$ya = (array) $pedido->get_meta('_abasto_pedidos');
		$grupos = abasto_lineas_por_mayorista($this->items_de($pedido));
		$faltan_reintentar = false;

		foreach ($grupos as $mayorista_id => $lineas) {
			if (isset($ya[$mayorista_id])) {
				continue;
			}
			$datos = [
				'mayoristaId' => $mayorista_id,
				'metodoPago' => (string) get_option('abasto_metodo_pago', 'CONTRA_ENTREGA'),
				'lineas' => $lineas,
			];
			$entrega = abasto_entrega($this->direccion_de($pedido));
			if ($entrega) {
				$datos['entrega'] = $entrega;
			}

			$r = $this->cliente->crear_pedido(abasto_clave_de_pedido(home_url(), $pedido_id, $mayorista_id), $datos);
			$estado = is_array($r['datos']) ? (string) ($r['datos']['estado'] ?? '') : '';

			if ($r['ok'] && in_array($estado, ['aplicada', 'repetida'], true)) {
				$respuesta = (array) ($r['datos']['respuesta'] ?? []);
				$ya[$mayorista_id] = ['id' => (string) ($respuesta['id'] ?? ''), 'codigo' => (string) ($respuesta['codigo'] ?? '')];
				$pedido->update_meta_data('_abasto_pedidos', $ya);
				$pedido->add_order_note(sprintf('Pedido enviado a Abasto: %s.', $ya[$mayorista_id]['codigo']));
				continue;
			}

			// Un rechazo de Abasto no se arregla reintentando: lo tiene que ver la tienda
			if ($r['ok']) {
				$motivo = is_array($r['datos']) ? (string) ($r['datos']['error'] ?? 'Abasto no aceptó el pedido.') : 'Abasto no aceptó el pedido.';
				$pedido->add_order_note('Abasto no aceptó el pedido: ' . $motivo);
				continue;
			}
			if ($r['estado'] === 0 || $r['estado'] >= 500) {
				$faltan_reintentar = true;
				continue;
			}
			$pedido->add_order_note('No se pudo enviar a Abasto: ' . (string) $r['error']);
		}
		$pedido->save();

		if ($faltan_reintentar) {
			$espera = self::REINTENTOS[$intento] ?? null;
			if ($espera === null) {
				$pedido->add_order_note('Abasto no respondió después de varios intentos. Vuelve a guardar el pedido para reintentar.');
				return;
			}
			wp_schedule_single_event(time() + $espera, 'abasto_reintentar_pedido', [$pedido_id, $intento + 1]);
			$pedido->add_order_note('Abasto no responde en este momento. Se vuelve a intentar solo.');
		}
	}

	/** @return array<int, array{producto_id: ?string, mayorista_id: ?string, presentacion: ?string, cantidad: int}> */
	private function items_de(WC_Order $pedido): array
	{
		$items = [];
		foreach ($pedido->get_items() as $item) {
			$producto = $item->get_product();
			if (!$producto) {
				continue;
			}
			// Las variaciones heredan del producto padre
			$fuente = $producto->get_parent_id() ? wc_get_product($producto->get_parent_id()) : $producto;
			$items[] = [
				'producto_id' => $fuente ? (string) $fuente->get_meta('_abasto_producto_id') : null,
				'mayorista_id' => $fuente ? (string) $fuente->get_meta('_abasto_mayorista_id') : null,
				'presentacion' => $fuente ? (string) $fuente->get_meta('_abasto_presentacion') : null,
				'cantidad' => (int) $item->get_quantity(),
			];
		}
		return $items;
	}

	private function direccion_de(WC_Order $pedido): array
	{
		$calle = trim($pedido->get_shipping_address_1() . ' ' . $pedido->get_shipping_address_2());
		if ($calle === '') {
			$calle = trim($pedido->get_billing_address_1() . ' ' . $pedido->get_billing_address_2());
		}
		return [
			'calle' => $calle,
			'zona' => $pedido->get_shipping_city() ?: $pedido->get_billing_city(),
			'referencia' => $pedido->get_customer_note(),
		];
	}
}
