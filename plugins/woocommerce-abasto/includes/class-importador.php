<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * Trae el catálogo de un mayorista a WooCommerce. Lo nuevo entra como borrador: la tienda decide qué publicar.
 * Volver a importar actualiza el costo y la presentación; el precio de venta que la tienda cambió a mano no se pisa.
 */
final class Abasto_Importador
{
	public function __construct(private Abasto_Cliente $cliente)
	{
	}

	/** @return array{creados: int, actualizados: int, sin_precio: int, error: ?string} */
	public function importar(string $mayorista_id, string $busqueda, float $margen): array
	{
		$r = $this->cliente->productos($mayorista_id, $busqueda);
		if (!$r['ok']) {
			return ['creados' => 0, 'actualizados' => 0, 'sin_precio' => 0, 'error' => $r['error']];
		}
		$cuenta = ['creados' => 0, 'actualizados' => 0, 'sin_precio' => 0, 'error' => null];
		foreach ((array) $r['datos'] as $datos) {
			if (!is_array($datos) || empty($datos['id'])) {
				continue;
			}
			$escala = abasto_escala_para_importar((array) ($datos['escalas'] ?? []));
			if (!$escala) {
				$cuenta['sin_precio']++;
				continue;
			}
			$centavos = (int) $escala['precioUnitario']['centavos'];
			$unidades = (int) $escala['cantidad'];
			$sku = abasto_sku((string) $datos['id']);
			$existente = wc_get_product_id_by_sku($sku);
			$producto = $existente ? wc_get_product($existente) : new WC_Product_Simple();
			if (!$producto) {
				continue;
			}
			if (!$existente) {
				$producto->set_sku($sku);
				$producto->set_status('draft');
				$producto->set_regular_price((string) abasto_precio_de_venta($centavos, $unidades, $margen));
				$producto->set_description(wp_kses_post((string) ($datos['descripcion'] ?? '')));
			}
			$producto->set_name(sanitize_text_field((string) ($datos['nombre'] ?? $datos['id'])));
			$producto->update_meta_data('_abasto_producto_id', (string) $datos['id']);
			$producto->update_meta_data('_abasto_mayorista_id', (string) ($datos['mayorista']['id'] ?? $mayorista_id));
			$producto->update_meta_data('_abasto_presentacion', (string) $escala['presentacion']);
			$producto->update_meta_data('_abasto_costo_centavos', $centavos * $unidades);
			$producto->save();
			$cuenta[$existente ? 'actualizados' : 'creados']++;
		}
		return $cuenta;
	}
}
