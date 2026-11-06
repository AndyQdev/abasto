<?php
/**
 * La lógica del plugin, sin nada de WordPress: se prueba sola con tests/logica.test.php.
 */

if (!defined('ABSPATH') && !defined('ABASTO_PRUEBAS')) {
	exit;
}

/** Cuánto vale un aviso firmado. Con esto, uno viejo capturado no sirve para repetirlo. */
const ABASTO_VENTANA_DE_FIRMA_SEGUNDOS = 300;

/**
 * La clave de idempotencia de un pedido: siempre la misma para el mismo pedido de esta tienda y este mayorista
 * (UUID v5). Así WooCommerce puede avisar dos veces, o reintentarse, y Abasto no crea otro.
 */
function abasto_clave_de_pedido(string $sitio, int $pedido_id, string $mayorista_id): string
{
	// Espacio de nombres propio de Abasto, fijo para siempre: cambiarlo duplicaría los pedidos en curso
	$espacio = hex2bin('6f8a2c1e4b7d4c3a9e015d2f7a3b8c10');
	$hash = sha1($espacio . untrailingslash_abasto($sitio) . '|' . $pedido_id . '|' . $mayorista_id);
	return sprintf(
		'%s-%s-%04x-%04x-%s',
		substr($hash, 0, 8),
		substr($hash, 8, 4),
		(hexdec(substr($hash, 12, 4)) & 0x0fff) | 0x5000,
		(hexdec(substr($hash, 16, 4)) & 0x3fff) | 0x8000,
		substr($hash, 20, 12)
	);
}

function untrailingslash_abasto(string $texto): string
{
	return rtrim($texto, '/');
}

/**
 * Convierte los ítems de un pedido de WooCommerce en un pedido de Abasto por mayorista.
 * Lo que no vino de Abasto se ignora: la tienda también vende cosas propias.
 *
 * @param array<int, array{producto_id: ?string, mayorista_id: ?string, presentacion: ?string, cantidad: int}> $items
 * @return array<string, array<int, array{productoId: string, presentacion: string, cantidad: int}>> por mayorista
 */
function abasto_lineas_por_mayorista(array $items): array
{
	$grupos = [];
	foreach ($items as $item) {
		if (empty($item['producto_id']) || empty($item['mayorista_id']) || empty($item['presentacion']) || $item['cantidad'] < 1) {
			continue;
		}
		$clave = $item['producto_id'] . '|' . $item['presentacion'];
		$mayorista = $item['mayorista_id'];
		if (isset($grupos[$mayorista][$clave])) {
			// El mismo producto en dos líneas se suma: Abasto recibe una sola
			$grupos[$mayorista][$clave]['cantidad'] += $item['cantidad'];
			continue;
		}
		$grupos[$mayorista][$clave] = [
			'productoId' => $item['producto_id'],
			'presentacion' => $item['presentacion'],
			'cantidad' => $item['cantidad'],
		];
	}
	return array_map('array_values', $grupos);
}

/**
 * Lo que entra de la dirección de envío de WooCommerce. Null si no hay calle: Abasto la toma como opcional.
 *
 * @param array{calle?: ?string, zona?: ?string, referencia?: ?string} $direccion
 * @return array{calle: string, zona?: string, referencia?: string}|null
 */
function abasto_entrega(array $direccion): ?array
{
	$calle = trim((string) ($direccion['calle'] ?? ''));
	if ($calle === '') {
		return null;
	}
	$entrega = ['calle' => function_exists('mb_substr') ? mb_substr($calle, 0, 200) : substr($calle, 0, 200)];
	$zona = trim((string) ($direccion['zona'] ?? ''));
	if ($zona !== '') {
		$entrega['zona'] = substr($zona, 0, 200);
	}
	$referencia = trim((string) ($direccion['referencia'] ?? ''));
	if ($referencia !== '') {
		$entrega['referencia'] = substr($referencia, 0, 300);
	}
	return $entrega;
}

/**
 * Comprueba un aviso de Abasto: la firma es HMAC-SHA256 de «fecha.cuerpo» con el secreto, y la fecha es reciente.
 */
function abasto_firma_valida(string $secreto, string $fecha, string $cuerpo, string $firma, int $ahora): bool
{
	if ($secreto === '' || !ctype_digit($fecha)) {
		return false;
	}
	if (abs($ahora - (int) $fecha) > ABASTO_VENTANA_DE_FIRMA_SEGUNDOS) {
		return false;
	}
	$esperada = 'sha256=' . hash_hmac('sha256', $fecha . '.' . $cuerpo, $secreto);
	return hash_equals($esperada, $firma);
}

/** La nota que queda en el pedido de WooCommerce por cada aviso. Null si el evento no le interesa a la tienda. */
function abasto_nota_de_evento(string $tipo, array $datos): ?string
{
	$codigo = isset($datos['codigo']) ? (string) $datos['codigo'] : '';
	$pedido = $codigo !== '' ? "Abasto {$codigo}" : 'Abasto';
	switch ($tipo) {
		case 'pedido.confirmado':
			return "{$pedido}: el mayorista confirmó el pedido.";
		case 'pedido.rechazado':
			$motivo = isset($datos['motivo']) ? ' Motivo: ' . (string) $datos['motivo'] : '';
			return "{$pedido}: el mayorista rechazó el pedido.{$motivo}";
		case 'pedido.cancelado':
			return "{$pedido}: el pedido se canceló.";
		case 'pedido.en_preparacion':
			return "{$pedido}: están preparando el pedido.";
		case 'pedido.despachado':
			return "{$pedido}: el pedido salió a entrega.";
		case 'pedido.entregado':
			return "{$pedido}: el pedido se entregó.";
		case 'cobro.qr_pagado':
			return "{$pedido}: se pagó el QR.";
		case 'cobro.pago_registrado':
			return "{$pedido}: el mayorista registró un pago.";
		default:
			return null;
	}
}

/**
 * El precio de venta en WooCommerce de una presentación: lo que cuesta la presentación entera más el margen.
 * Null si esta tienda no puede ver el precio (todavía no es cliente de ese mayorista).
 */
function abasto_precio_de_venta(?int $centavos_por_unidad, int $unidades, float $margen_porcentaje): ?string
{
	if ($centavos_por_unidad === null || $unidades < 1) {
		return null;
	}
	$costo = $centavos_por_unidad * $unidades;
	return number_format(round($costo * (1 + max(0.0, $margen_porcentaje) / 100)) / 100, 2, '.', '');
}

/**
 * La escala que se importa: la más chica, porque es la que un cliente final compra.
 *
 * @param array<int, array{presentacion: string, cantidad: int, precioUnitario: ?array{centavos: int}}> $escalas
 */
function abasto_escala_para_importar(array $escalas): ?array
{
	$con_precio = array_values(array_filter($escalas, static fn ($e) => isset($e['precioUnitario']['centavos'])));
	if (!$con_precio) {
		return null;
	}
	usort($con_precio, static fn ($a, $b) => $a['cantidad'] <=> $b['cantidad']);
	return $con_precio[0];
}

/** Lee el SKU con el que se reconoce un producto importado de Abasto. */
function abasto_sku(string $producto_id): string
{
	return 'abasto-' . $producto_id;
}

/** Saca del mensaje de Conecta algo que se le pueda mostrar a la tienda. */
function abasto_motivo_de_error(int $estado, ?array $cuerpo): string
{
	$mensaje = is_array($cuerpo) && isset($cuerpo['message']) && is_string($cuerpo['message']) ? $cuerpo['message'] : '';
	if ($estado === 401) {
		return 'Abasto no reconoce la llave. Revisa que esté bien copiada o saca otra en la app.';
	}
	if ($estado >= 500 || $estado === 0) {
		return 'Abasto no responde en este momento. Se vuelve a intentar solo.';
	}
	return $mensaje !== '' ? $mensaje : "Abasto respondió {$estado}.";
}
