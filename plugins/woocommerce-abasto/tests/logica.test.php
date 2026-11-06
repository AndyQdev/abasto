<?php
/**
 * Pruebas de la lógica del plugin, sin WordPress. Corre con `pnpm test:plugin`.
 */

define('ABASTO_PRUEBAS', true);
require __DIR__ . '/../includes/logica.php';

$fallas = 0;
$hechas = 0;

function comprobar(string $nombre, mixed $obtenido, mixed $esperado): void
{
	global $fallas, $hechas;
	$hechas++;
	if ($obtenido === $esperado) {
		return;
	}
	$fallas++;
	echo "FALLA: {$nombre}\n  esperaba: " . var_export($esperado, true) . "\n  obtuvo:   " . var_export($obtenido, true) . "\n";
}

// Clave de idempotencia
$clave = abasto_clave_de_pedido('https://mitienda.bo', 15, 'abasto');
comprobar('la clave es un UUID v5', (bool) preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $clave), true);
comprobar('el mismo pedido da siempre la misma clave', abasto_clave_de_pedido('https://mitienda.bo/', 15, 'abasto'), $clave);
comprobar('otro pedido da otra clave', abasto_clave_de_pedido('https://mitienda.bo', 16, 'abasto') === $clave, false);
comprobar('otro mayorista da otra clave', abasto_clave_de_pedido('https://mitienda.bo', 15, 'lp') === $clave, false);
comprobar('otra tienda da otra clave', abasto_clave_de_pedido('https://otra.bo', 15, 'abasto') === $clave, false);

// Líneas por mayorista
$grupos = abasto_lineas_por_mayorista([
	['producto_id' => 'AB-1', 'mayorista_id' => 'abasto', 'presentacion' => 'UNIDAD', 'cantidad' => 2],
	['producto_id' => 'AB-1', 'mayorista_id' => 'abasto', 'presentacion' => 'UNIDAD', 'cantidad' => 3],
	['producto_id' => 'AB-1', 'mayorista_id' => 'abasto', 'presentacion' => 'CAJA', 'cantidad' => 1],
	['producto_id' => 'LP-9', 'mayorista_id' => 'lp', 'presentacion' => 'DOCENA', 'cantidad' => 1],
	['producto_id' => null, 'mayorista_id' => null, 'presentacion' => null, 'cantidad' => 4],
	['producto_id' => 'AB-2', 'mayorista_id' => 'abasto', 'presentacion' => 'UNIDAD', 'cantidad' => 0],
]);
comprobar('agrupa por mayorista e ignora lo que no es de Abasto', array_keys($grupos), ['abasto', 'lp']);
comprobar('suma el mismo producto en la misma presentación', $grupos['abasto'], [
	['productoId' => 'AB-1', 'presentacion' => 'UNIDAD', 'cantidad' => 5],
	['productoId' => 'AB-1', 'presentacion' => 'CAJA', 'cantidad' => 1],
]);
comprobar('un pedido sin nada de Abasto no manda nada', abasto_lineas_por_mayorista([['producto_id' => '', 'mayorista_id' => '', 'presentacion' => '', 'cantidad' => 1]]), []);

// Entrega
comprobar('sin calle no hay entrega', abasto_entrega(['calle' => '  ', 'zona' => 'Plan 3000']), null);
comprobar('solo manda lo que hay', abasto_entrega(['calle' => ' Av. Banzer 123 ', 'zona' => '', 'referencia' => 'portón negro']), ['calle' => 'Av. Banzer 123', 'referencia' => 'portón negro']);

// Firma
$ahora = 1_800_000_000;
$fecha = (string) $ahora;
$cuerpo = '{"tipo":"pedido.confirmado"}';
$firma = 'sha256=' . hash_hmac('sha256', "{$fecha}.{$cuerpo}", 'secreto');
comprobar('acepta la firma correcta', abasto_firma_valida('secreto', $fecha, $cuerpo, $firma, $ahora), true);
comprobar('rechaza otro secreto', abasto_firma_valida('otro', $fecha, $cuerpo, $firma, $ahora), false);
comprobar('rechaza un cuerpo cambiado', abasto_firma_valida('secreto', $fecha, '{"tipo":"otro"}', $firma, $ahora), false);
comprobar('rechaza un aviso viejo repetido', abasto_firma_valida('secreto', $fecha, $cuerpo, $firma, $ahora + 301), false);
comprobar('acepta poca diferencia de reloj', abasto_firma_valida('secreto', $fecha, $cuerpo, $firma, $ahora + 299), true);
comprobar('sin secreto guardado rechaza todo', abasto_firma_valida('', $fecha, $cuerpo, 'sha256=' . hash_hmac('sha256', "{$fecha}.{$cuerpo}", ''), $ahora), false);
comprobar('rechaza una fecha que no es número', abasto_firma_valida('secreto', 'ayer', $cuerpo, $firma, $ahora), false);

// Notas
comprobar('nota de confirmado', abasto_nota_de_evento('pedido.confirmado', ['codigo' => 'A-10']), 'Abasto A-10: el mayorista confirmó el pedido.');
comprobar('el rechazo trae el motivo', abasto_nota_de_evento('pedido.rechazado', ['codigo' => 'A-10', 'motivo' => 'Sin stock']), 'Abasto A-10: el mayorista rechazó el pedido. Motivo: Sin stock');
comprobar('lo interno no deja nota', abasto_nota_de_evento('cobro.credito_autorizado', ['codigo' => 'A-10']), null);

// Precio de venta
comprobar('precio de la presentación con margen', abasto_precio_de_venta(1000, 12, 20.0), '144.00');
comprobar('sin margen', abasto_precio_de_venta(1050, 1, 0.0), '10.50');
comprobar('un margen negativo no baja del costo', abasto_precio_de_venta(1000, 1, -50.0), '10.00');
comprobar('sin precio visible no hay precio', abasto_precio_de_venta(null, 12, 20.0), null);

// Escala a importar
comprobar('importa la presentación más chica con precio', abasto_escala_para_importar([
	['presentacion' => 'CAJA', 'cantidad' => 48, 'precioUnitario' => ['centavos' => 900]],
	['presentacion' => 'UNIDAD', 'cantidad' => 1, 'precioUnitario' => null],
	['presentacion' => 'DOCENA', 'cantidad' => 12, 'precioUnitario' => ['centavos' => 950]],
])['presentacion'], 'DOCENA');
comprobar('si no hay precios, no se importa', abasto_escala_para_importar([['presentacion' => 'CAJA', 'cantidad' => 48, 'precioUnitario' => null]]), null);

// Errores
comprobar('una llave mala se explica', abasto_motivo_de_error(401, null), 'Abasto no reconoce la llave. Revisa que esté bien copiada o saca otra en la app.');
comprobar('un error interno no se muestra', abasto_motivo_de_error(500, ['message' => 'TypeError: x']), 'Abasto no responde en este momento. Se vuelve a intentar solo.');
comprobar('un motivo de negocio se muestra', abasto_motivo_de_error(400, ['message' => 'Falta la cabecera']), 'Falta la cabecera');

echo $fallas ? "{$fallas} de {$hechas} fallaron\n" : "{$hechas} comprobaciones en verde\n";
exit($fallas ? 1 : 0);
