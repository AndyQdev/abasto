# Gestión · Angular 21 zoneless · dueño: Jhoel (Pedidos y Cuentas por cobrar: Andrés)

Microfrontend del Panel (puerto 5171), publicado como `<abasto-gestion ruta="...">` con @angular/elements y Shadow DOM.

- No tiene router propio: la ruta llega como atributo desde el Shell y la sesión como propiedad `sesion`.
- Todo dato viene por GraphQL federado (`graphql.ts`, contra el Router). Una pantalla pide exactamente los campos que muestra.
- Las vistas están en `src/app/vistas/`. Las que faltan usan `en-construccion` con su fase. Diseño: versión 7 «Halo» (`docs/uix-mockup/image1-3.png`).
- Estilos con los tokens que define el Shell (`estilos.ts`: cabecera, tres cifras, filtros en cápsula, botones en cápsula, panel lateral). Iconos con `<abasto-icono nombre="…">` (`icono.ts`). Las cantidades siempre van con unidad (`cantidadConUnidad`).
- **Pedidos:** tablero de tres columnas (Por confirmar, Preparando, En reparto) con tarjetas compactas y un solo botón (el paso que sigue). Un toque abre el detalle al costado, con todos los productos y el rechazo con su motivo. Filtros Todos, Hoy, Urgentes (más de 1 h por confirmar) y Entregados. La lógica pura está en `columnaDe` y `filtrarPedidos`.
- **Compras:** una tarjeta por puesto con casillas de «comprado». Lo marcado se recuerda por día en este navegador (`localStorage`): es la lista de quien sale al mercado. «Imprimir lista» usa el CSS de impresión del Shell.
- **Productos:** cuadrícula o lista. Interruptor Activo/Pausado (`editarProducto` con `estado`) y formulario al costado para crear o editar: precios por volumen, costo, proveedor, stock, usos y foto (se achica a 900 px antes de `cambiarFotoDeProducto`).
- **Clientes:** las solicitudes de la red privada y «Te compran», armado con `misVentas` (`compradores`).
- **Cuentas por cobrar (CU-09, 03/11):** `vistas/cuentas.ts`. Tres cifras (por cobrar, vencido, vence en 7 días), filtros (Todas, Vencidas, Por vencer, Contra entrega, Pagadas), una tarjeta por cuenta con el vencimiento en palabras y la barra de lo pagado. Al costado se registra el pago (monto con «Todo» o «La mitad», forma y nota); el `pagoId` se genera al abrir para que un doble toque no cobre dos veces. El panel lee la cuenta por id de la lista, nunca una copia vieja. Lógica pura: `vencimientoDe`, `filtrarCuentas`, `centavosDe` («1.200,50»).
- Lo que dejó el buscador del header llega como `?q=` en la URL y con el evento `abasto:buscar`.

Probar: `pnpm --filter @abasto/panel-gestion test`.
