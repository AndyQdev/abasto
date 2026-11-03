# Plan · Herramientas gratis por tipo de cliente («Mi casa», «Mi tienda», «Mi producción»)

Pedido de Andrés (01/11/2026). Estado (02/11): **fases 1 a 6 hechas y probadas**: todo queda en la base de datos (tipo de negocio en Catálogo, lo demás en el esquema `negocio` de Cobros) y el teléfono guarda solo mientras no hay señal.

## La idea

Abasto deja de ser solo «donde compro» y pasa a ser «donde manejo mi negocio o mi casa». Lo que nadie más tiene:
**lo que el cliente compra en Abasto entra solo a su inventario**, sin tipearlo. Por eso vuelve, y por eso un día le
avisamos «se te acaba la harina el jueves, ¿la pido?». Un preventista no puede hacer eso.

## Los tres tipos (reemplazan a tienda / masas / cocina del 01/11)

| Tipo | Quién | Subtipo | Pestaña | Lo que gana (frase del registro) |
|---|---|---|---|---|
| `hogar` | La mamá que compra al por mayor para su familia | — | Mi casa | Ahorra en la compra del mes y lleva la cuenta de tu casa |
| `tienda` | Abarrotes que compra para revender | — | Mi tienda | Repón sin ir al mercado y mira cuánto ganas |
| `productor` | Compra insumos y vende un producto hecho | `salteneria` · `panaderia` · `pension` | Mi producción | Compra tus insumos y sabe cuánto te cuesta cada unidad |

El subtipo del productor sigue decidiendo sus secciones de compra («Para tu salteñería», «Para tu panadería»,
«Para tu pensión» y «Para llevar»). Lo que ya estaba guardado en el teléfono se traduce solo: `masas` pasa a
productor-salteñería y `cocina` a productor-pensión (`leerNegocio` en `packages/comercio/src/negocios.ts`).

## Arquitectura (01/11, decisión de Andrés: todo queda en la base de datos)

**Regla:** todo lo de «Mi negocio» vive en la base de datos del servidor. El teléfono guarda una copia para andar sin
señal y una cola de cambios que se sube sola cuando vuelve la señal. Si la persona entra con el mismo número en otro
celular, se baja todo lo suyo. Un solo motor para los tres tipos; lo que cambia por tipo es la pantalla.

| Qué | Dónde | Por qué ahí |
|---|---|---|
| **El tipo de negocio** (hogar, tienda o productor + subtipo) | **Catálogo** · MongoDB · `organizaciones.negocio` | Cada cliente de la app ya es una `Organizacion` de Catálogo (la crea `entrarConCodigo`; su id es el `org_id` del token). El tipo es parte de su perfil, como la ciudad o el NIT. Abasto lo ve en el Superadmin y lo usa para segmentar. |
| **Mi negocio**: artículos, movimientos, ventas, fiado, recetas, tandas, cuentas y lista fija | **Cobros** · PostgreSQL · esquema propio **`negocio`** · módulo `src/mi-negocio` con sus capas (dominio, aplicación, infraestructura, interfaz) | Es dinero y cuentas por cobrar del cliente (ventas, fiado, gastos), lo más cercano a Cobros. Va en un **esquema separado y un módulo separado**: no se mezcla con los cobros de la saga y se puede sacar a un servicio propio sin tocar la app. No suma un sexto servicio. |
| La lógica (existencias, costo, receta, planificador, caja, reporte) | `packages/comercio/src/mi-negocio` | La misma función calcula en el teléfono (sin señal) y en el servidor: nunca dan distinto. |
| La copia sin señal y la cola de cambios | Teléfono · SQLite (`apps/app/src/almacen-negocio.ts`) | Solo para no depender de la señal. |

**Toda fila es del cliente**: cada tabla lleva `org_id` (del token) y todas las consultas filtran por él. Un cliente
nunca ve lo de otro.

### Cómo se sincroniza (sin señal primero, sin conflictos)

- **Los movimientos y las ventas solo se agregan, nunca se editan** (como el kardex de Solvexco y los asientos de
  Cobros). Cada uno trae un id único que arma el teléfono: subirlo dos veces no lo duplica.
- **Lo que sí se edita** (un artículo, una receta, un cliente de fiado, la lista fija) lleva `actualizadoEn` y gana el
  cambio más nuevo. Borrar es marcar `eliminado`, para que el borrado también viaje.
- El teléfono sube su cola con `sincronizarMiNegocio(cambios)` y baja lo nuevo con `miNegocio(desde)`. `desde` es la
  marca del servidor de la última bajada (no el reloj del teléfono). Un celular nuevo baja con `desde` vacío: todo.

### Las compras en Abasto entran solas, también en el servidor

Cuando Pedidos publica `pedido.entregado`, el módulo Mi negocio de Cobros arma las ENTRADAS de ese pedido con la
misma clave que usa el teléfono (`pedido:<id>:<producto>:<presentación>`). Así queda en la base aunque la persona no
abra la app, y si el teléfono también la registró sin señal, no se duplica.

## Modelo de datos (esquema `negocio` en Postgres; tomado de Solvexco y simplificado)

Solvexco (`supabase/migrations/0006`, `0008`, `0012` y `0020`) separa materia prima de producto terminado, tiene
fórmulas con `rinde`, órdenes de producción con consumo y resultado, un libro de movimientos (kardex) y cuentas por
cobrar. Aquí queda lo mismo al nivel de una salteñería. Todas las tablas llevan `org_id`; los montos van en centavos
(enteros) y las cantidades en `numeric(14,3)`.

| Tabla | Para qué | Campos | De Solvexco |
|---|---|---|---|
| `articulo` | Lo que la persona tiene: comprado (insumo, mercadería, despensa) o hecho | id, org_id, nombre, detalle, rubro, envase, por_envase, unidad, clase (`COMPRADO` · `HECHO`), origen (`ABASTO` · `OTRO_PROVEEDOR`), producto_id (del catálogo), proveedor, precio_venta_centavos, stock_minimo, actualizado_en, eliminado | `producto` + `stock_minimo` |
| `movimiento` | El libro: todo lo que entra y sale. La existencia es su suma | id, org_id, articulo_id, tipo (`ENTRADA` · `AJUSTE` · `VENTA` · `CONSUMO` · `PRODUCCION`), cantidad (con signo), costo_unitario_centavos, origen (`ABASTO` · `OTRO_PROVEEDOR` · `MANUAL` · `VENTA` · `TANDA`), clave_unica (única por org), venta_id, tanda_id, fecha, nota | `movimiento_inventario` |
| `venta` | Lo que vende la tienda o el productor (caja rápida) | id, org_id, fecha, total_centavos, costo_centavos, forma (`CONTADO` · `FIADO`), cliente_id, anulada | pedido de venta |
| `venta_linea` | Cada producto de la venta | venta_id, articulo_id, cantidad, precio_unitario_centavos, costo_unitario_centavos | |
| `cliente_fiado` | A quién le fía | id, org_id, nombre, telefono, actualizado_en, eliminado | cliente |
| `fiado` | El cuaderno: lo que debe y lo que paga | id, org_id, cliente_id, tipo (`DEBE` · `PAGA`), monto_centavos, venta_id, fecha, nota | `cuenta_por_cobrar` + `pago_cliente` |
| `receta` | «100 salteñas = 5 kg de harina…» | id, org_id, articulo_id (lo que se hace), nombre, rinde, actualizado_en, eliminado | `formula` + `formula_version` |
| `receta_insumo` | Cada insumo de la receta | receta_id, articulo_id, cantidad (en la unidad de base del insumo: kg, u., L) | `formula_item` |
| `tanda` | Lo que se hizo: consumió insumos y dio producto | id, org_id, receta_id, planificado, obtenido, costo_total_centavos, fecha | `orden_produccion` + consumo + resultado |
| `anotacion` | Las cuentas de la casa y los gastos del negocio | id, org_id, tipo (`INGRESO` · `GASTO`), monto_centavos, categoria, nota, origen (`MANUAL` · `ABASTO`), clave_unica, fecha | — |
| `lista_fija` | La compra de cada semana del hogar | id, org_id, producto_id, presentacion, cantidad, actualizado_en, eliminado | — |

Reglas:
- La existencia nunca se guarda: es la suma de los movimientos, como el kardex de Solvexco.
- Vender descuenta (`VENTA`, cantidad negativa) y guarda el costo de ese momento: así la ganancia del mes no cambia
  si después sube el precio.
- Costo de la receta = Σ (cantidad del insumo × costo promedio del insumo) / rinde. Con eso sale el **costo por salteña**.
- Registrar una tanda: un `CONSUMO` por insumo (proporcional a lo que se planificó) y una `PRODUCCION` de lo hecho con
  su costo. Si salió menos de lo planificado, la merma se ve en la tanda (planificado − obtenido).
- Planificador: «300 salteñas el sábado» → insumos × (300 / rinde) − existencia → lo que falta → «Pedir lo que falta
  a Abasto» arma el carrito con los productos del catálogo (`producto_id`).
- **Precio sugerido = costo × (1 + margen).** El margen sirve a todo el que vende: la tienda (lo que revende, 20 % por
  defecto) y el productor (lo que hace, 50 % por defecto, porque suma su trabajo). El hogar no vende. Cada precio se
  cambia a mano por producto.
- «Se te acaba en ~N días»: con lo que se compró y lo que se contó, sobre lo que queda. Siempre dice «estimado».

## Pantallas por tipo

Una pestaña nueva en la barra de abajo, con el nombre del tipo. Todo con pocos toques y números grandes.

**Hogar · Mi casa**
- Arriba: «Te quedan Bs X este mes» (ingresos − gastos) y dos botones, «+ Ingreso» y «+ Gasto», de un toque.
- Despensa: lo comprado en Abasto con «se te acaba en ~5 días» y «Volver a pedir».
- La lista fija de la semana y «Ahorraste Bs X frente al súper» (con el precio del súper que ya trae el catálogo).
- Más adelante: pedido con vecinas (se junta el pedido y se divide el envío).

**Tienda · Mi tienda**
- Inventario: lo de Abasto entra solo, y con «+ Producto» se suma lo de otros proveedores.
- Vender: caja rápida (tocar el producto o escanear el código, cantidad, «Cobrado» o «Fiado»). Descuenta del inventario.
- Precio de venta sugerido (costo + margen elegido) y la ganancia de cada producto.
- Stock bajo → «Pedir de nuevo» con un toque.
- Cuaderno de fiado: quién debe, cuánto y desde cuándo, y «Pagó».
- El mes: vendí, me costó, gané (bruta), gastos y me quedó (neta), en palabras simples.

**Productor · Mi producción**
- Insumos (entran solos al comprar en Abasto) y productos hechos, por separado.
- Recetas por lote, con el costo por unidad calculado.
- **Planificador** (la estrella): «Quiero hacer 300 salteñas el sábado» → lo que tengo, lo que falta y «Pedir lo que
  falta a Abasto».
- Registrar un lote hecho, con su merma.
- Vender lo hecho (la misma caja de la tienda) y ver la ganancia real por unidad y por mes.

## Fases

| Fase | Qué | Estimación | Riesgo para la demo |
|---|---|---|---|
| **1 · hecha** | Registro obligatorio con los 3 tipos (y el subtipo del productor), ilustraciones 3D nuevas, Inicio adaptado a hogar, tienda y productor, cambio en Cuenta y pruebas | 1 día | Ninguno: solo app y `packages/comercio` |
| **2 · hecha** | Motor en `packages/comercio/src/mi-negocio` (articulo, movimiento, existencias, compras de Abasto que entran solas) + almacén SQLite + la pestaña con el inventario de los tres tipos | 1 día | Ninguno: no toca servicios (e2e 16/16) |
| **3 · hecha** | **Todo a la base de datos**: el tipo de negocio en Catálogo; el módulo Mi negocio en Cobros (esquema `negocio`, subgrafo `miNegocio` y `sincronizarMiNegocio`); la app sube su cola y baja lo suyo al entrar en otro celular; las compras entregadas entran también desde el servidor | 2 días | Medio: toca Catálogo, Cobros y el supergrafo (con e2e) |
| **4 · hecha** | Tienda: caja rápida, precio sugerido, poco stock → «pedir de nuevo», cuaderno de fiado y el mes | 2 días | Bajo |
| **5 · hecha** | Productor: recetas, costo por unidad, planificador → «pedir lo que falta», tandas, venta de lo hecho y el mes | 2–3 días | Bajo |
| **6 · hecha** | Hogar: ingresos y gastos, despensa con «se te acaba», lista fija y ahorro frente al súper | 2 días | Bajo |

La entrega es alrededor del 10/11. Ninguna fase cambia la saga ni los casos de uso de `docs/requisitos.md`.

## Decisiones (01/11, Andrés)

- **Todo en la base de datos**, no solo en el teléfono (ver «Arquitectura»). El teléfono guarda solo mientras no hay señal.
- **Margen sugerido:** 20 % para lo que revende la tienda y 50 % para lo que hace el productor; editable por producto.
- **Pedido con vecinas:** buena idea, para el futuro.

## Cómo quedó (02/11)

- **Catálogo:** `organizaciones.negocio` (`NegocioDelCliente`: tipo, subtipo, elegidoEn), `miTipoDeNegocio` y `elegirTipoDeNegocio`; también `MiOrganizacion.negocio` y `Tienda.negocio` (federación).
- **Cobros:** módulo `src/mi-negocio` (dominio, aplicación, infraestructura, interfaz), esquema Postgres `negocio` con las 11 tablas, `miNegocio(desde)` y `sincronizarMiNegocio(cambios)`. Escucha `pedido.entregado` (cola `cobros.mi-negocio`): crea los artículos y las entradas con la misma clave que el teléfono y el gasto del pedido. Pedidos agrega `lineas` a sus eventos (cambio aditivo del contrato). Nombre y rubro los pide a Catálogo con la cuenta de servicio `cobros-servicio`.
- **App:** pestaña Mi casa / Mi tienda / Producción con sus secciones; copia y cola en SQLite; sube sola y baja todo en un celular nuevo.
- **Pruebas:** comercio 103, app 70 (pantallas y sincronización), Cobros 49 + 5 de integración, Catálogo 145, e2e 18 (incluye `mi-negocio.spec.ts` y `mi-negocio-servidor.spec.ts`).
- **Pendiente:** el Superadmin no tiene lista de tiendas (para ver el tipo de cada cliente); el pedido con vecinas; `separarContenido` y `medidaDeContenido` están copiados en Cobros (si cambian en comercio, cambiar la copia: lo fija una prueba).

