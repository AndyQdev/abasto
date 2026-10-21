# ICONIX

El método va del modelo de dominio a los casos de uso, después a la robustez, a la secuencia y a las clases. Cada diagrama se guarda aquí como fuente (PlantUML o Mermaid) para que entre en el repo y se pueda revisar en un PR.

| Paso | Archivo | Qué tiene |
|---|---|---|
| 1. Modelo de dominio | `dominio.md` | Mayorista, Tienda, RelacionComercial, ListaDePrecios, Producto, EscalaDePrecio, Pedido, LineaDePedido, LineaDeCredito, Cuota, Pago |
| 2. Casos de uso | `casos-de-uso.md` | La tabla de abajo, con el texto de cada caso (curso básico y alternos) |
| 3. Robustez | `robustez/CU-xx.md` | Un diagrama por caso: actor, pantalla (frontera), control y entidades |
| 4. Secuencia | `secuencia/CU-xx.md` | Un diagrama por caso, con los mensajes reales entre servicios |
| 5. Clases | `clases.md` | Las clases de dominio de cada servicio, tal como están en el código |

## Casos de uso

Cada caso tiene dueño, la interfaz donde ocurre y la prueba automática que lo cubre. Un caso está terminado cuando su prueba existe y pasa en la CI.

| Caso | Actor | Interfaz | Servicios | Dueño | Fase |
|---|---|---|---|---|---|
| CU-01 Verificar un mayorista | Admin | Superadmin | Catálogo | Andrés (pantalla) · Jhoel (servicio) | F1 |
| CU-02 Publicar un producto con escalas | Mayorista | Gestión, Campo | Catálogo | Jhoel | F1 |
| CU-03 Pedir ser cliente de un mayorista | Tienda | Mercado | Catálogo | Andrés (pantalla) · Jhoel (servicio) | F1 |
| CU-04 Aprobar un cliente con lista de precios y crédito | Mayorista | Gestión (Clientes) | Catálogo, Cobros | Jhoel | F1 |
| CU-05 Buscar en el catálogo (texto o foto) | Tienda | Mercado | Catálogo, ML | Andrés · Jhoel | F1 |
| CU-06 Hacer un pedido | Tienda | Mercado | Pedidos, Catálogo, Cobros | Andrés | F2 |
| CU-07 Confirmar o rechazar un pedido | Mayorista | Gestión (Pedidos) | Pedidos | Andrés | F2 |
| CU-08 Pagar con QR o a crédito | Tienda | Mercado | Cobros | Andrés | F2 |
| CU-09 Registrar un pago de una cuenta por cobrar | Mayorista | Gestión (Cuentas) | Cobros | Andrés | F2 |
| CU-10 Conectar un e-commerce (API, WooCommerce, MCP) | Tienda | Mercado (Integraciones) | Conecta | Andrés | F3 |
| CU-11 Pedir por WhatsApp | Tienda | WhatsApp → n8n | Conecta, Pedidos | Andrés | F3 |
| CU-12 Tomar un pedido sin señal | Mayorista | Campo | Conecta, Pedidos | Jhoel | F4 |
| CU-13 Preguntarle a los datos | Mayorista | Inteligencia (Reportes) | Asistente | Jhoel | F5 |
| CU-14 Aprobar la propuesta de un agente | Mayorista | Inteligencia (Agentes) | Asistente, n8n | Jhoel | F5 |

Ya tienen prueba punta a punta: la sesión única (Panel → Mercado), el Panel con sus tres frameworks y CU-13 (pregunta → tabla → Excel). Ya tienen prueba de servicio: la red privada (CU-03/04/05), la saga (CU-06, del lado de Pedidos), la idempotencia de Conecta (CU-11 y CU-12) y la guardia SQL (CU-13).
