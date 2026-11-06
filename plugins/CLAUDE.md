# Plugins · dueño: Andrés

`woocommerce-abasto/`: plugin de WordPress para que una tienda con WooCommerce compre en Abasto (CU-10). Habla solo con la API pública de Conecta, con la llave que la tienda saca en la app. No conoce Pedidos, Catálogo ni Cobros.

- `includes/logica.php`: lo que se puede probar sin WordPress (clave de idempotencia UUID v5, agrupar por mayorista, firma de los avisos, notas, precio con margen).
- `class-pedidos.php`: al pasar a «Procesando» o «Completado» manda lo de Abasto, un pedido por mayorista. La clave sale del sitio, el pedido y el mayorista: reintentar nunca duplica. Reintenta con `wp_schedule_single_event` si Conecta no responde; un rechazo no se reintenta y queda como nota.
- `class-avisos.php`: `POST /wp-json/abasto/v1/avisos`. Autentica con la firma HMAC sobre el cuerpo tal como llegó y rechaza avisos de más de 5 minutos. Lo repetido se descarta con un transient por `X-Abasto-Entrega`.
- `class-importador.php`: lo nuevo entra como borrador; volver a importar no pisa el precio que la tienda cambió a mano.
- `class-ajustes.php`: WooCommerce › Abasto. Permiso `manage_woocommerce`, nonce en cada acción, y la llave guardada no vuelve a la pantalla.

Probar:
- `pnpm test:plugin`: la lógica, sin WordPress.
- `pnpm woocommerce` levanta WordPress + WooCommerce de verdad en Docker (8095, `admin` / `admin`) y `WOOCOMMERCE=1 pnpm e2e pruebas/woocommerce.spec.ts` prueba de punta a punta (necesita `pnpm todo`). `pnpm woocommerce:borrar` lo limpia. La MariaDB de esa prueba es lo que WordPress necesita: Abasto no usa MySQL.
- `pnpm plugin:zip` arma `plugins/dist/abasto-woocommerce.zip` para instalarlo.
