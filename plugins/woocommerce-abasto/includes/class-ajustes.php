<?php
if (!defined('ABSPATH')) {
	exit;
}

/** WooCommerce › Abasto: conectar la tienda, importar el catálogo y prender los avisos. */
final class Abasto_Ajustes
{
	private const PERMISO = 'manage_woocommerce';
	private const PAGINA = 'abasto';

	public function __construct(private Abasto_Cliente $cliente, private Abasto_Importador $importador)
	{
		add_action('admin_menu', [$this, 'menu'], 60);
		add_action('admin_post_abasto_guardar', [$this, 'guardar']);
		add_action('admin_post_abasto_importar', [$this, 'importar']);
		add_action('admin_post_abasto_avisos', [$this, 'prender_avisos']);
		add_action('admin_notices', [$this, 'mostrar_resultado']);
	}

	public function menu(): void
	{
		add_submenu_page('woocommerce', 'Abasto', 'Abasto', self::PERMISO, self::PAGINA, [$this, 'pagina']);
	}

	private function exigir(string $accion): void
	{
		if (!current_user_can(self::PERMISO)) {
			wp_die('No tienes permiso para esto.', 403);
		}
		check_admin_referer($accion);
	}

	private function volver(string $mensaje, string $tipo = 'success'): void
	{
		set_transient('abasto_resultado_' . get_current_user_id(), ['mensaje' => $mensaje, 'tipo' => $tipo], 60);
		wp_safe_redirect(admin_url('admin.php?page=' . self::PAGINA));
		exit;
	}

	public function mostrar_resultado(): void
	{
		$clave = 'abasto_resultado_' . get_current_user_id();
		$r = get_transient($clave);
		if (!is_array($r)) {
			return;
		}
		delete_transient($clave);
		printf('<div class="notice notice-%s is-dismissible"><p>%s</p></div>', esc_attr($r['tipo']), esc_html($r['mensaje']));
	}

	public function guardar(): void
	{
		$this->exigir('abasto_guardar');
		update_option('abasto_api', esc_url_raw(trim((string) wp_unslash($_POST['abasto_api'] ?? ''))), false);
		// Si se deja vacío no se borra: el campo nunca muestra la llave guardada
		$llave = sanitize_text_field((string) wp_unslash($_POST['abasto_llave'] ?? ''));
		if ($llave !== '') {
			update_option('abasto_llave', $llave, false);
		}
		$metodo = sanitize_text_field((string) wp_unslash($_POST['abasto_metodo_pago'] ?? 'CONTRA_ENTREGA'));
		update_option('abasto_metodo_pago', in_array($metodo, ['CONTRA_ENTREGA', 'CREDITO', 'QR'], true) ? $metodo : 'CONTRA_ENTREGA', false);
		update_option('abasto_margen', max(0.0, (float) wp_unslash($_POST['abasto_margen'] ?? 20)), false);

		$prueba = $this->cliente->mayoristas();
		if (!$prueba['ok']) {
			$this->volver('Guardado, pero no se pudo conectar: ' . (string) $prueba['error'], 'error');
		}
		$this->volver('Conectado con Abasto.');
	}

	public function importar(): void
	{
		$this->exigir('abasto_importar');
		$mayorista = sanitize_text_field((string) wp_unslash($_POST['abasto_mayorista'] ?? ''));
		$busqueda = sanitize_text_field((string) wp_unslash($_POST['abasto_busqueda'] ?? ''));
		if ($mayorista === '') {
			$this->volver('Elige de qué mayorista importar.', 'error');
		}
		$r = $this->importador->importar($mayorista, $busqueda, (float) get_option('abasto_margen', 20));
		if ($r['error']) {
			$this->volver((string) $r['error'], 'error');
		}
		$mensaje = sprintf('Importados: %d nuevos como borrador y %d actualizados.', $r['creados'], $r['actualizados']);
		if ($r['sin_precio']) {
			$mensaje .= sprintf(' %d sin importar porque ese mayorista todavía no te aprobó como cliente.', $r['sin_precio']);
		}
		$this->volver($mensaje);
	}

	public function prender_avisos(): void
	{
		$this->exigir('abasto_avisos');
		$r = $this->cliente->registrar_aviso(Abasto_Avisos::direccion());
		if (!$r['ok']) {
			$this->volver('No se pudieron prender los avisos: ' . (string) $r['error'], 'error');
		}
		$anterior = (string) get_option('abasto_id_aviso', '');
		if ($anterior !== '') {
			$this->cliente->borrar_aviso($anterior);
		}
		update_option('abasto_secreto_avisos', (string) $r['datos']['secreto'], false);
		update_option('abasto_id_aviso', (string) $r['datos']['datos']['id'], false);
		$this->volver('Listo: cada cambio de un pedido en Abasto queda como nota en tu pedido.');
	}

	public function pagina(): void
	{
		if (!current_user_can(self::PERMISO)) {
			return;
		}
		$conectada = (string) get_option('abasto_llave', '') !== '' && (string) get_option('abasto_api', '') !== '';
		$mayoristas = $conectada ? $this->cliente->mayoristas() : ['ok' => false, 'datos' => []];
		$metodo = (string) get_option('abasto_metodo_pago', 'CONTRA_ENTREGA');
		?>
		<div class="wrap">
			<h1>Abasto</h1>
			<p>Los pedidos de tu tienda llegan solos a tu mayorista en Abasto, y nunca entran dos veces.</p>

			<h2>1. Conecta tu tienda</h2>
			<p>La llave la sacas en la app de Abasto: Cuenta › Conectar mi tienda en línea.</p>
			<form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
				<input type="hidden" name="action" value="abasto_guardar" />
				<?php wp_nonce_field('abasto_guardar'); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="abasto_api">Dirección de Abasto</label></th>
						<td><input class="regular-text" id="abasto_api" name="abasto_api" type="url" value="<?php echo esc_attr((string) get_option('abasto_api', '')); ?>" placeholder="https://conecta.abasto.bo" /></td>
					</tr>
					<tr>
						<th scope="row"><label for="abasto_llave">Llave</label></th>
						<td>
							<input class="regular-text" id="abasto_llave" name="abasto_llave" type="password" autocomplete="off" placeholder="<?php echo $conectada ? 'Guardada. Escribe otra solo para cambiarla' : 'abk_…'; ?>" />
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="abasto_metodo_pago">Cómo le pagas a tu mayorista</label></th>
						<td>
							<select id="abasto_metodo_pago" name="abasto_metodo_pago">
								<option value="CONTRA_ENTREGA" <?php selected($metodo, 'CONTRA_ENTREGA'); ?>>Contra entrega</option>
								<option value="CREDITO" <?php selected($metodo, 'CREDITO'); ?>>A crédito</option>
								<option value="QR" <?php selected($metodo, 'QR'); ?>>QR</option>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="abasto_margen">Tu ganancia al importar (%)</label></th>
						<td><input id="abasto_margen" name="abasto_margen" type="number" min="0" step="0.5" value="<?php echo esc_attr((string) get_option('abasto_margen', 20)); ?>" /></td>
					</tr>
				</table>
				<?php submit_button('Guardar y probar'); ?>
			</form>

			<?php if ($conectada) : ?>
				<h2>2. Trae el catálogo</h2>
				<?php if (!$mayoristas['ok']) : ?>
					<p>No se pudieron leer los mayoristas: <?php echo esc_html((string) ($mayoristas['error'] ?? '')); ?></p>
				<?php else : ?>
					<form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
						<input type="hidden" name="action" value="abasto_importar" />
						<?php wp_nonce_field('abasto_importar'); ?>
						<p>
							<label for="abasto_mayorista">Mayorista</label>
							<select id="abasto_mayorista" name="abasto_mayorista">
								<?php foreach ((array) $mayoristas['datos'] as $m) : ?>
									<option value="<?php echo esc_attr((string) $m['id']); ?>"><?php echo esc_html((string) $m['nombre']); ?></option>
								<?php endforeach; ?>
							</select>
							<label for="abasto_busqueda">Solo lo que diga</label>
							<input id="abasto_busqueda" name="abasto_busqueda" type="search" placeholder="arroz" />
						</p>
						<p class="description">Entran como borrador, para que elijas qué publicar. El precio de venta que cambies a mano no se pisa.</p>
						<?php submit_button('Importar', 'secondary'); ?>
					</form>
				<?php endif; ?>

				<h2>3. Prende los avisos</h2>
				<p>Cada cambio de un pedido en Abasto (confirmado, despachado, entregado) queda como nota en tu pedido.</p>
				<p><?php echo get_option('abasto_id_aviso') ? 'Los avisos están prendidos.' : 'Todavía no están prendidos.'; ?></p>
				<form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
					<input type="hidden" name="action" value="abasto_avisos" />
					<?php wp_nonce_field('abasto_avisos'); ?>
					<?php submit_button(get_option('abasto_id_aviso') ? 'Volver a conectarlos' : 'Prender avisos', 'secondary'); ?>
				</form>
			<?php endif; ?>
		</div>
		<?php
	}
}
