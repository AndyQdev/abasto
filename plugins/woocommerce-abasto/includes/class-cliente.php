<?php
if (!defined('ABSPATH')) {
	exit;
}

/** Habla con Conecta, la API pública de Abasto, con la llave que la tienda sacó en la app. */
final class Abasto_Cliente
{
	/** @return array{ok: bool, estado: int, datos: mixed, error: ?string} */
	private function pedir(string $metodo, string $ruta, ?array $cuerpo = null, array $cabeceras = []): array
	{
		$llave = (string) get_option('abasto_llave', '');
		$base = rtrim((string) get_option('abasto_api', ''), '/');
		if ($llave === '' || $base === '') {
			return ['ok' => false, 'estado' => 0, 'datos' => null, 'error' => 'Falta la dirección de Abasto o la llave. Complétalas en WooCommerce › Abasto.'];
		}
		$r = wp_remote_request($base . $ruta, [
			'method' => $metodo,
			'timeout' => 20,
			'headers' => array_merge(['Authorization' => 'Bearer ' . $llave, 'Content-Type' => 'application/json', 'Accept' => 'application/json'], $cabeceras),
			'body' => $cuerpo === null ? null : wp_json_encode($cuerpo),
		]);
		if (is_wp_error($r)) {
			return ['ok' => false, 'estado' => 0, 'datos' => null, 'error' => abasto_motivo_de_error(0, null)];
		}
		$estado = (int) wp_remote_retrieve_response_code($r);
		$datos = json_decode((string) wp_remote_retrieve_body($r), true);
		$ok = $estado >= 200 && $estado < 300;
		return ['ok' => $ok, 'estado' => $estado, 'datos' => $datos, 'error' => $ok ? null : abasto_motivo_de_error($estado, is_array($datos) ? $datos : null)];
	}

	public function mayoristas(): array
	{
		return $this->pedir('GET', '/v1/mayoristas');
	}

	public function productos(string $mayorista_id, string $busqueda = ''): array
	{
		$consulta = http_build_query(array_filter(['mayoristaId' => $mayorista_id, 'busqueda' => $busqueda]));
		return $this->pedir('GET', '/v1/productos' . ($consulta ? '?' . $consulta : ''));
	}

	public function crear_pedido(string $clave, array $datos): array
	{
		return $this->pedir('POST', '/v1/pedidos', $datos, ['Idempotency-Key' => $clave, 'X-Abasto-Origen' => 'tienda-en-linea']);
	}

	public function registrar_aviso(string $url): array
	{
		return $this->pedir('POST', '/v1/webhooks', ['url' => $url]);
	}

	public function borrar_aviso(string $id): array
	{
		return $this->pedir('DELETE', '/v1/webhooks/' . rawurlencode($id));
	}
}
