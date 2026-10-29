# ICONIX

El método va del modelo de dominio a los casos de uso, después a la robustez, a la secuencia y a las clases. Cada diagrama se guarda aquí como fuente Mermaid para que entre en el repo y se pueda revisar en un PR.

| Paso | Archivo | Qué tiene |
|---|---|---|
| 1. Modelo de dominio | [dominio.md](dominio.md) | Organizacion, RelacionComercial, ListaDePrecios, Producto, EscalaDePrecio, ReservaDeStock, LineaReservada, Pedido, LineaDePedido, SagaDeCompra, LineaDeCredito y CobroQr |
| 2. Casos de uso | [casos-de-uso.md](casos-de-uso.md) | Actores, la tabla nueva y el texto ICONIX de CU-02, 04, 05, 06, 12, 13, 14 y 15 |
| 3. Robustez | [robustez/](robustez/) | Un diagrama por caso: actor, pantalla (frontera), control y entidades |
| 4. Secuencia | [secuencia/](secuencia/) | Un diagrama por caso, con los mensajes reales entre servicios |
| 5. Clases | [clases.md](clases.md) | Las clases de Catálogo, Pedidos, Cobros y Asistente, por capas |

## Casos de uso

| Caso | Actor | Interfaz | Servicios | Dueño |
|---|---|---|---|---|
| CU-01 Verificar un mayorista | Admin | Superadmin | Catálogo | Andrés (pantalla) · Jhoel (servicio) |
| CU-02 Publicar un producto con escalas y foto | Mayorista | Gestión (Productos) | Catálogo | Jhoel |
| CU-03 Pedir ser cliente de un mayorista | Cliente | App (Vendedor) | Catálogo | Andrés (pantalla) · Jhoel (servicio) |
| CU-04 Aprobar un cliente con lista de precios y crédito | Mayorista | Gestión (Clientes) | Catálogo, Cobros | Jhoel |
| CU-05 Buscar en el catálogo (texto o foto) | Cliente | App (Buscar, BuscarPorFoto) | Catálogo, ML | Andrés (pantalla) · Jhoel (ML) |
| CU-06 Hacer un pedido | Cliente | App (Carrito, Finalizar) | Pedidos, Catálogo, Cobros | Andrés |
| CU-07 Confirmar o rechazar un pedido | Mayorista | Gestión (Pedidos) | Pedidos | Andrés |
| CU-08 Pagar con QR, a crédito o contra entrega | Cliente | App (Finalizar, Seguimiento) | Cobros | Andrés |
| CU-09 Registrar un pago de una cuenta por cobrar | Mayorista | Gestión (Cuentas por cobrar) | Cobros (Pendiente) | Andrés |
| CU-10 Conectar un e-commerce (API, WooCommerce, MCP) | Mayorista | Pendiente: confirmar pantalla con Andrés | Conecta | Andrés |
| CU-11 Pedir por WhatsApp | Cliente | WhatsApp → n8n | Conecta, Pedidos | Andrés |
| CU-12 Hacer un pedido sin señal | Cliente | App (catálogo guardado y bandeja) | Conecta, Pedidos | Andrés |
| CU-13 Preguntarle a los datos (texto o voz) | Mayorista | Inteligencia (Reportes) | Asistente | Jhoel |
| CU-14 Aprobar la propuesta de un agente | Mayorista | Inteligencia (Agentes) | Asistente, n8n | Jhoel |
| CU-15 Preparar, despachar y entregar un pedido | Mayorista | Gestión (Pedidos) | Pedidos | Andrés |
| CU-16 Comprar en el mercado lo vendido bajo pedido | Abasto | Gestión (Compras) | Pedidos, Catálogo | Andrés |
| CU-17 Ver la tracción de la red | Admin | Superadmin (Tracción) | Pedidos | Andrés |

## Archivos por caso

- Robustez: [CU-02](robustez/CU-02.md) · [CU-04](robustez/CU-04.md) · [CU-05](robustez/CU-05.md) · [CU-06](robustez/CU-06.md) · [CU-13](robustez/CU-13.md) · [CU-15](robustez/CU-15.md).
- Secuencia: [CU-04](secuencia/CU-04.md) · [CU-06](secuencia/CU-06.md) · [CU-13](secuencia/CU-13.md) · [CU-15](secuencia/CU-15.md).

## Pruebas que existen hoy

`e2e/pruebas/` tiene `abasto-vende.spec.ts`, `compra.spec.ts`, `panel.spec.ts` y `red-privada.spec.ts`: cubren la compra de punta a punta, el Panel y la red privada. Por servicio hay pruebas de Catálogo (`services/catalogo/tests/Unit` y `tests/Feature`), Pedidos (`SagaDeCompraTest`, `TraccionTest`, `PedidosIT`), Cobros (`linea-de-credito.spec.ts`, `cobro-qr.spec.ts`, `atender-comando.spec.ts`) y Asistente (`guardia-sql.spec.ts`, `responder-pregunta.spec.ts`, `consultor.pg.e2e-spec.ts`).

Pendiente: no hay prueba de una pantalla de verificación de mayoristas (CU-01), del formulario de producto con foto (CU-02), del pago de cuentas por cobrar (CU-09) ni de una pantalla de Conecta (CU-10).
