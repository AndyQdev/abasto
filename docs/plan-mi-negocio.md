# Plan · Herramientas gratis por tipo de cliente («Mi casa», «Mi tienda», «Mi producción»)

Pedido de Andrés (01/11/2026, por la sesión de la junta). Estado: **Fase 1 hecha; las fases 2 a 5 esperan su revisión.**

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

## Arquitectura: un solo motor, tres pantallas

**Un motor para los tres** (productos propios, movimientos, recetas y lotes). Lo que cambia por tipo es la pantalla:
el hogar no ve recetas y la tienda no ve lotes, pero los datos son los mismos.

Dónde vive:

1. **La lógica, en `packages/comercio/src/mi-negocio/`**: funciones puras y probadas con Vitest, como el resto
   de la lógica de compra. Calcula existencias a partir de los movimientos, el costo de la receta, el planificador,
   la caja y el reporte del mes.
2. **Los datos, primero en el teléfono** (SQLite, `expo-sqlite`, que la app ya usa para la bandeja sin señal). Así
   funciona sin señal, no toca ningún servicio y no puede romper la saga ni la demo del 03/11.
3. **Las compras en Abasto entran solas**: cuando un pedido de `misCompras` llega a ENTREGADO, cada línea es un
   movimiento `ENTRADA` con origen `ABASTO` y clave `pedido:<codigo>:<linea>`. Esa clave lo hace idempotente: se
   puede leer `misCompras` cuantas veces sea sin duplicar nada. El costo sale del precio pagado.
4. **El respaldo en la nube es una fase aparte (la 5).** Propuesta: un módulo `mi-negocio` en **Cobros** (NestJS +
   Postgres, de Andrés), que ya maneja dinero y cuentas por cobrar, expuesto como subgrafo en el Router. No suma un
   servicio nuevo: la decisión de los cinco servicios no se reabre.

Por qué no directo en un servicio: llevaría migraciones, schema federado, supergrafo y pruebas de saga a dos días
de la entrega. Con el teléfono primero, el valor se ve igual en la demo y el respaldo llega después sin cambiar las
pantallas (la misma interfaz `Almacen` que ya usa la bandeja).

## Modelo de datos (tomado de Solvexco y simplificado)

Solvexco (`supabase/migrations/0006`, `0008`, `0012` y `0020`) separa materia prima de producto terminado, tiene
fórmulas versionadas con `rinde`, órdenes de producción con consumo y resultado, un libro de movimientos (kardex) y
cuentas por cobrar. Aquí queda lo mismo al nivel de una salteñería: sin versiones, sin almacenes y sin lotes de
trazabilidad.

| Tabla | Campos | De Solvexco |
|---|---|---|
| `articulo` | id, nombre, unidad (kg, u, L, maple…), clase (`INSUMO` · `PRODUCTO` · `REVENTA` · `DESPENSA`), producto_abasto_id?, codigo_barras?, precio_venta?, stock_minimo? | `producto` + `stock_minimo` |
| `movimiento` | id, articulo_id, tipo (`ENTRADA` · `SALIDA` · `AJUSTE` · `CONSUMO` · `PRODUCCION` · `VENTA` · `MERMA`), cantidad, costo_unitario?, origen (`ABASTO` · `OTRO_PROVEEDOR` · `MANUAL` · `LOTE` · `VENTA`), clave_unica, fecha | `movimiento_inventario` (libro) |
| `receta` | id, articulo_id (lo que se hace), rinde (ej. 100 salteñas), nota | `formula` + `formula_version` (una sola versión) |
| `receta_item` | receta_id, articulo_id (insumo), cantidad, unidad | `formula_item` |
| `lote` | id, receta_id, cantidad_planificada, cantidad_obtenida, merma, fecha, estado (`PLANIFICADO` · `HECHO`) | `orden_produccion` + `consumo_produccion` + `resultado_produccion` |
| `venta` | id, fecha, total, cobrado (bool), cliente_fiado_id? | (pedido de venta, simplificado) |
| `venta_linea` | venta_id, articulo_id, cantidad, precio | |
| `fiado` | id, nombre, telefono? | `cuenta_por_cobrar` |
| `fiado_movimiento` | fiado_id, tipo (`DEBE` · `PAGA`), monto, venta_id?, fecha | `pago_cliente` |
| `cuenta` (hogar) | id, tipo (`INGRESO` · `GASTO`), monto, categoria, fecha, origen (`MANUAL` · `ABASTO`) | — |

Reglas:
- La existencia nunca se guarda: es la suma de los movimientos, como el kardex de Solvexco.
- Costo de la receta = Σ (cantidad del insumo × costo promedio del insumo) / rinde. Con eso sale el **costo por salteña**.
- Registrar un lote hecho: un `CONSUMO` por insumo (proporcional a lo planificado), una `PRODUCCION` del producto y
  una `MERMA` si salió menos.
- Planificador: «300 salteñas el sábado» → insumos × (300 / rinde) − existencia → lo que falta → «Pedir lo que falta
  a Abasto» arma el carrito con los productos del catálogo que corresponden (`producto_abasto_id`).
- «Se te acaba en ~N días»: consumo promedio de las últimas semanas sobre la existencia. Siempre dice «estimado» y
  nunca inventa urgencias.

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
| 2 | Motor en `packages/comercio/src/mi-negocio` (articulo, movimiento, existencias, compras de Abasto que entran solas) + almacén SQLite + la pestaña con el inventario de los tres tipos | 2 días | Bajo: no toca servicios |
| 3 | Tienda: caja rápida, precio sugerido, stock bajo → pedir, cuaderno de fiado y el mes | 2–3 días | Bajo |
| 4 | Productor: recetas, costo por unidad, planificador → «pedir lo que falta», lotes con merma, venta | 3 días | Bajo |
| 5 | Hogar: ingresos y gastos, despensa con «se te acaba», ahorro frente al súper. Después, el respaldo en la nube (módulo `mi-negocio` en Cobros + subgrafo) y los avisos | 2 días + 3 días | Medio (toca un servicio): **después del 03/11** |

Para el 03/11 alcanza con la Fase 1 y, si Andrés lo aprueba, la 2. Ninguna fase cambia la saga, los contratos ni los
casos de uso que ya están en `docs/requisitos.md`.

## Pendiente de decidir con Andrés

- ¿El respaldo en la nube va en Cobros o en un servicio nuevo? Uno nuevo reabre la decisión de los cinco servicios.
- ¿Cómo se hace el pedido con vecinas: un pedido compartido o varios con un solo envío?
- El margen por defecto para el precio sugerido de la tienda (¿20 %?).
