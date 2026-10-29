# Andrés · estado

Actualizado: 29/10/2026 · rama andres/abasto-vende (integra mis ramas y las de Jhoel)

## Estoy en
Modelo de lanzamiento «Abasto vende» (28/10): Abasto es el vendedor de la casa y compra bajo pedido.

## Terminé
- Infra, Pedidos (saga, outbox, inbox, plazos), Conecta, n8n, CI y e2e.
- Cobros en la saga: autorizar y liberar crédito, QR que vence a los 30 min, pagarQrDePrueba y Pedido.cobro por federación.
- Mercado: Inicio, Buscar, fichas, carrito, finalizar (QR, crédito o contra entrega), Mis pedidos y seguimiento de la saga.
- Abasto vende:
  - Catálogo: Abasto como vendedor de la casa y productos BAJO_PEDIDO con costo y proveedor (`catalogo:semilla-abasto`).
  - Pedidos: CONTRA_ENTREGA, listaDeCompras, avanzarEntrega y traccion (solo admin).
  - Panel: Compras (lista por puesto con margen) y Preparar/Despachar/Entregar en Pedidos.
  - Superadmin: Tracción.
  - Usuario ventas@abasto.bo (org abasto).
- e2e: 14 pruebas en verde.

## Cambié en contratos
- Cobros: cobroDePedido, pagarQrDePrueba, CobroQr y Pedido.cobro.
- Catálogo: Producto.abastecimiento/entregaHoras/costoUnitario/proveedor, Mayorista.deLaCasa e inputs de crear/editar.
- Pedidos: MetodoPago.CONTRA_ENTREGA, listaDeCompras, avanzarEntrega y traccion.
- AsyncAPI: contra_entrega y pedido.en_preparacion | despachado | entregado. OpenAPI de Conecta: CONTRA_ENTREGA.

## Necesito del otro
- Jhoel: revisar los cambios en services/catalogo (vendedor de la casa y bajo pedido) y el módulo Compras en el menú del Shell.
- Jhoel (cuando pueda): que el proyector de Asistente registre pedido.en_preparacion, despachado y entregado.
- Catálogo: un campo con la lista de la tienda en Mayorista y una foto por producto.

## Sigue
- Registro de tiendas nuevas desde la app (sin pedírselo a nadie) para la promoción.
- Registrar el cobro de los pedidos contra entrega y las cuentas por cobrar (CU-09).
- Investigar de dónde y cómo cargar el catálogo real.
