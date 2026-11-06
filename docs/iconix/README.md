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

Interfaces desde el replanteo del 29/10:
- **App de clientes** (`apps/app`, Expo, Android e iPhone): la usan las tiendas y las personas para comprar.
- **Panel** (web PWA: Shell React + Gestión Angular + Inteligencia Vue): lo usa el mayorista para gestionar.
- **Superadmin** (web React): lo usa Abasto para aprobar mayoristas y ver la tracción.
- Mercado (web) y Campo (app aparte) ya no existen.

Dueños: Andrés lleva lo comercial y Jhoel toda la IA.

| Caso | Actor | Interfaz | Servicios | Dueño | Fase |
|---|---|---|---|---|---|
| CU-01 Registrarse como mayorista y ser verificado | Mayorista → Admin | Panel (registro) → Superadmin (Mayoristas) | Catálogo, Keycloak | Andrés | F1 |
| CU-02 Publicar un producto con escalas y foto | Mayorista | Panel › Gestión (Productos) | Catálogo | Andrés | F1 |
| CU-03 Pedir ser cliente de un mayorista | Tienda | App (Vendedor) | Catálogo | Andrés | F1 |
| CU-04 Aprobar un cliente con lista de precios y crédito | Mayorista | Panel › Gestión (Clientes) | Catálogo, Cobros | Andrés | F1 |
| CU-05 Buscar en el catálogo (texto o foto) | Tienda | App (Buscar, Buscar por foto) | Catálogo + IA local del teléfono | Andrés (búsqueda) · Jhoel (IA local) | F1 |
| CU-06 Hacer un pedido | Tienda | App (Carrito, Finalizar) | Pedidos, Catálogo, Cobros (saga) | Andrés | F2 |
| CU-07 Confirmar o rechazar un pedido y entregarlo | Mayorista | Panel › Gestión (Pedidos, Compras) | Pedidos | Andrés | F2 |
| CU-08 Pagar con QR, a crédito o contra entrega | Tienda | App (Finalizar, Seguimiento) | Cobros | Andrés | F2 |
| CU-09 Registrar un pago de una cuenta por cobrar | Mayorista | Panel › Gestión (Cuentas) | Cobros | Andrés | F2 |
| CU-10 Conectar un e-commerce (API, WooCommerce, MCP) | Tienda | App (Cuenta › Conectar mi tienda en línea) | Conecta | Andrés | F3 |
| CU-11 Pedir por WhatsApp | Tienda | WhatsApp → n8n | Conecta, Pedidos | Andrés | F3 |
| CU-12 Pedir sin señal | Tienda | App (bandeja sin señal) | Conecta, Pedidos | Andrés | F4 |
| CU-13 Preguntarle a los datos (texto o voz) | Mayorista | Panel › Inteligencia (Reportes) | Asistente + IA local del navegador | Jhoel | F5 |
| CU-14 Aprobar la propuesta de un agente | Mayorista | Panel › Inteligencia (Agentes) | Asistente, n8n | Jhoel | F5 |
| CU-15 Registrarse como tienda | Tienda | App (Entrar: celular y código) | Catálogo, Keycloak | Andrés | F1 |
| CU-16 Reportar un problema con un pedido | Tienda → Admin | App (Seguimiento) → Superadmin (Reclamos) | Pedidos | Andrés | F5 |

Tienen prueba punta a punta: la sesión única (Panel → Superadmin), el Panel con sus tres frameworks, CU-01, CU-03/04/05 (red privada), CU-04 (crédito), CU-06 y CU-08 (la saga), CU-09, CU-10 (con WooCommerce real), CU-16, CU-11 (con el n8n de verdad, si está arriba), CU-12 y CU-13. Lo que falta conectar afuera está marcado **Pendiente** en cada caso: WhatsApp real (CU-11, CU-15) y un banco real (CU-08).

## Archivos por caso

- Robustez: [CU-01](robustez/CU-01.md) · [CU-02](robustez/CU-02.md) · [CU-03](robustez/CU-03.md) · [CU-04](robustez/CU-04.md) · [CU-05](robustez/CU-05.md) · [CU-06](robustez/CU-06.md) · [CU-07](robustez/CU-07.md) · [CU-08](robustez/CU-08.md) · [CU-09](robustez/CU-09.md) · [CU-10](robustez/CU-10.md) · [CU-11](robustez/CU-11.md) · [CU-12](robustez/CU-12.md) · [CU-13](robustez/CU-13.md) · [CU-14](robustez/CU-14.md) · [CU-15](robustez/CU-15.md) · [CU-16](robustez/CU-16.md).
- Secuencia: [CU-01](secuencia/CU-01.md) · [CU-02](secuencia/CU-02.md) · [CU-03](secuencia/CU-03.md) · [CU-04](secuencia/CU-04.md) · [CU-05](secuencia/CU-05.md) · [CU-06](secuencia/CU-06.md) · [CU-07](secuencia/CU-07.md) · [CU-08](secuencia/CU-08.md) · [CU-09](secuencia/CU-09.md) · [CU-10](secuencia/CU-10.md) · [CU-11](secuencia/CU-11.md) · [CU-12](secuencia/CU-12.md) · [CU-13](secuencia/CU-13.md) · [CU-14](secuencia/CU-14.md) · [CU-15](secuencia/CU-15.md) · [CU-16](secuencia/CU-16.md).
