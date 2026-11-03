# Modelo de dominio

Muestra los conceptos que existen hoy en el código de Catálogo (`services/catalogo/src/Catalogo/Dominio`), Pedidos (`services/pedidos/src/main/java/bo/abasto/pedidos/dominio`) y Cobros (`services/cobros/src/dominio`). No hay métodos: solo atributos clave y multiplicidades.

```mermaid
classDiagram
  class Organizacion {
    +String id
    +String nombre
    +String tipo
    +String ciudad
    +EstadoVerificacion verificacion
    +String nit
    +bool deLaCasa
  }
  class RelacionComercial {
    +String tiendaId
    +String mayoristaId
    +EstadoRelacion estado
    +ListaDePrecios lista
  }
  class ListaDePrecios {
    <<enumeration>>
    NUEVOS
    FRECUENTES
    VIP
  }
  class Producto {
    +String id
    +String mayoristaId
    +String codigo
    +String nombre
    +String rubro
    +String descripcion
    +int stock
    +EstadoProducto estado
    +List~EscalaDePrecio~ escalas
    +Abastecimiento abastecimiento
    +int entregaHoras
    +int costoUnitarioCentavos
    +String proveedor
  }
  class Abastecimiento {
    <<enumeration>>
    STOCK
    BAJO_PEDIDO
  }
  class EscalaDePrecio {
    +Presentacion presentacion
    +int unidades
    +int precioUnitarioCentavos
  }
  class Presentacion {
    <<enumeration>>
    UNIDAD
    CUARTA
    DOCENA
    CAJA
    FARDO
  }
  class ReservaDeStock {
    +String pedidoId
    +EstadoReserva estado
    +List~LineaReservada~ lineas
    +String motivo
  }
  class LineaReservada {
    +String productoId
    +int unidades
    +int precioUnitarioCentavos
    +bool descontado
  }
  class Pedido {
    +String id
    +String codigo
    +String clave
    +String tiendaId
    +String mayoristaId
    +EstadoPedido estado
    +MetodoPago metodoPago
    +Dinero total
    +Instant creadoEn
    +String motivoRechazo
  }
  class LineaDePedido {
    +String productoId
    +Presentacion presentacion
    +int cantidad
    +int unidades
    +Dinero precioUnitario
  }
  class SagaDeCompra {
    +Paso paso
    +bool stockReservado
    +bool cobrado
    +Instant venceConfirmacionEn
  }
  class LineaDeCredito {
    +String id
    +String tiendaId
    +String mayoristaId
    +Dinero limite
    +int plazoDias
    +Map reservas
    +Dinero usado
    +Dinero disponible
  }
  class CobroQr {
    +String id
    +String pedidoId
    +String tiendaId
    +String mayoristaId
    +Dinero monto
    +EstadoCobroQr estado
    +String codigo
    +Instant creadoEn
    +Instant venceEn
    +Instant pagadoEn
  }
  class CuentaPorCobrar {
    +String id
    +String pedidoId
    +String codigo
    +String tiendaId
    +String mayoristaId
    +OrigenDeCuenta origen
    +Dinero monto
    +Dinero pagado
    +Dinero saldo
    +EstadoDeCuenta estado
    +Instant venceEn
    +registrarPago(Pago)
  }
  class Pago {
    +String id
    +Dinero monto
    +FormaDePago forma
    +Instant registradoEn
    +String nota
  }
  class Dinero {
    +long centavos
    +String moneda
  }
  class Traccion {
    +int pedidos
    +Dinero ventas
    +Dinero ticketPromedio
    +int tiendasActivas
    +int tiendasQueRepiten
    +List~Semana~ semanas
    +List~TiendaCompradora~ tiendas
  }
  class Semana {
    +LocalDate desde
    +int pedidos
    +Dinero ventas
  }
  class TiendaCompradora {
    +String tiendaId
    +int pedidos
    +Dinero ventas
  }
  class ListaDeCompras {
  }
  class LineaDeCompra {
    +String productoId
    +int unidades
    +Dinero venta
    +List~String~ pedidos
  }
  class EstadoPedido {
    <<enumeration>>
    PENDIENTE
    POR_CONFIRMAR
    CONFIRMADO
    EN_PREPARACION
    DESPACHADO
    ENTREGADO
    RECHAZADO
    CANCELADO
  }
  class MetodoPago {
    <<enumeration>>
    QR
    CONTRA_ENTREGA
    CREDITO
  }
  class EstadoProducto {
    <<enumeration>>
    ACTIVO
    PAUSADO
    SIN_STOCK
    PENDIENTE_DE_REVISION
  }
  class EstadoRelacion {
    <<enumeration>>
    NINGUNA
    SOLICITADA
    APROBADA
    RECHAZADA
  }
  class EstadoReserva {
    <<enumeration>>
    RESERVADA
    RECHAZADA
    LIBERADA
  }
  class EstadoVerificacion {
    <<enumeration>>
    PENDIENTE
    VERIFICADO
    RECHAZADO
  }
  class EstadoCobroQr {
    <<enumeration>>
    PENDIENTE
    PAGADO
    VENCIDO
    DEVUELTO
    ANULADO
  }
  class Paso {
    <<enumeration>>
    RESERVANDO_STOCK
    COBRANDO
    ESPERANDO_MAYORISTA
    COMPLETADA
    COMPENSANDO
    COMPENSADA
  }

  Organizacion "1" --> "0..*" Producto : vende
  Organizacion "1" --> "0..*" RelacionComercial : es tienda
  Organizacion "1" --> "0..*" RelacionComercial : es mayorista
  RelacionComercial "0..*" --> "0..1" ListaDePrecios : usa
  Producto "1" *-- "1..*" EscalaDePrecio : publica
  Producto "1" --> "1" Abastecimiento : se abastece
  EscalaDePrecio "0..*" --> "1" Presentacion : se vende por
  Pedido "1" *-- "1..*" LineaDePedido : contiene
  LineaDePedido "0..*" --> "1" Producto : pide
  LineaDePedido "0..*" --> "1" Presentacion : en
  Pedido "1" --> "1" Dinero : total
  LineaDePedido "0..*" --> "0..1" Dinero : precio
  Pedido "1" --> "1" SagaDeCompra : sigue
  SagaDeCompra "1" --> "1" Paso : está en
  Pedido "1" --> "0..1" ReservaDeStock : reserva
  ReservaDeStock "1" *-- "1..*" LineaReservada : detalla
  LineaReservada "0..*" --> "1" Producto : descuenta
  LineaDeCredito "0..*" --> "1" Organizacion : tienda
  LineaDeCredito "0..*" --> "1" Organizacion : mayorista
  LineaDeCredito "1" --> "1" Dinero : límite
  CobroQr "0..*" --> "1" Pedido : cobra
  CuentaPorCobrar "0..1" --> "1" Pedido : se debe por
  CuentaPorCobrar "1" *-- "0..*" Pago : registra
  CuentaPorCobrar ..> LineaDeCredito : al saldar devuelve el cupo
  CobroQr "1" --> "1" Dinero : monto
  Traccion "1" *-- "0..*" Semana : agrupa
  Traccion "1" *-- "0..*" TiendaCompradora : ranking
  ListaDeCompras "1" ..> "0..*" LineaDeCompra : calcula
  Pedido "1" --> "1" EstadoPedido : está en
  Producto "1" --> "1" EstadoProducto : está en
  RelacionComercial "1" --> "1" EstadoRelacion : está en
  ReservaDeStock "1" --> "1" EstadoReserva : está en
  Organizacion "1" --> "1" EstadoVerificacion : está en
  CobroQr "1" --> "1" EstadoCobroQr : está en
```

**Organizacion** — Catálogo. Es la misma clase para tienda, mayorista y la organización de la casa (`deLaCasa`); `tipo` distingue el papel y `verificacion` guarda el estado. En GraphQL se expone como `Mayorista` o `Tienda`, pero no hay clases PHP separadas.

**RelacionComercial** — Catálogo. Une una tienda con un mayorista y guarda la lista de precios aprobada; nace en `SOLICITADA` y solo una relación `APROBADA` permite ver precios.

**ListaDePrecios** — Catálogo. Enum `NUEVOS` (100 %), `FRECUENTES` (97 %) y `VIP` (95 %).

**Producto** — Catálogo. Tiene escalas por presentación, stock y forma de abastecimiento. `BAJO_PEDIDO` significa que se compra cuando entra el pedido y no descuenta stock al reservar; también guarda costo y proveedor, que solo ve el mayorista.

**Abastecimiento** — Catálogo. Enum `STOCK` / `BAJO_PEDIDO`; una de las reglas de `Producto` impide que un producto bajo pedido quede en `SIN_STOCK`.

**EscalaDePrecio** — Catálogo. Una presentación con su cantidad de unidades y su precio unitario en centavos.

**Presentacion** — Catálogo. Enum `UNIDAD`, `CUARTA`, `DOCENA`, `CAJA` y `FARDO`.

**ReservaDeStock** — Catálogo. Es la respuesta de Catálogo a `catalogo.reservar_stock`: guarda las líneas reservadas, si se descontó stock y el motivo cuando rechaza.

**LineaReservada** — Catálogo. Producto, unidades y precio unitario que Catálogo devuelve a Pedidos; `descontado` indica si esa línea tocó el stock (las de `BAJO_PEDIDO` no).

**Pedido** — Pedidos. Tiene una clave de idempotencia, comprador, vendedor, líneas, método de pago y estado. El total se llena cuando Catálogo responde con precios.

**LineaDePedido** — Pedidos. Producto, presentación, cantidad pedida, unidades y precio; el precio queda nulo hasta que Catálogo lo fija.

**SagaDeCompra** — Pedidos. Máquina de estados de la compra: `RESERVANDO_STOCK`, `COBRANDO`, `ESPERANDO_MAYORISTA`, `COMPLETADA`, `COMPENSANDO` y `COMPENSADA`; el plazo del mayorista es de 2 h.

**LineaDeCredito** — Cobros. Límite, plazo (15 o 30 días) y reservas por pedido de una tienda con un mayorista; `autorizar` y `liberar` son idempotentes.

**CobroQr** — Cobros. Cobro por QR de un pedido, con monto, código `ABASTO-QR|...`, vencimiento y estado.

**Dinero** — Pedidos y Cobros. Valor en centavos con moneda `BOB`; Pedidos además lo expone como `texto` en el GraphQL.

**Traccion** — Pedidos. Resumen de ventas por semana y por tienda que consume el Superadmin.

**ListaDeCompras** — Pedidos. Agrupa por producto lo que hay que comprar para los pedidos `CONFIRMADO` y `EN_PREPARACION`; la usa Gestión (Compras).

**Estados** — Catálogo, Pedidos y Cobros. Cada agregado tiene su enum de estado; los nombres de arriba son los que existen en el código, no una traducción.

**CuentaPorCobrar** — Cobros (03/11, CU-09). Lo que una tienda le debe a un mayorista por un pedido a crédito o contra entrega; una por pedido. Nace con `pedido.confirmado`. Lo pagado nunca pasa el monto y un `Pago` repetido (mismo id) no se cuenta dos veces. Al saldar un crédito, la `LineaDeCredito` recupera el cupo.

**Pago** — Cobros. Efectivo, transferencia o QR, con fecha, quién lo anotó y una nota. Nunca se edita ni se borra.

Pendiente: no existen las clases `Tienda`, `Mayorista` ni `Cuota`. `Tienda` y `Mayorista` son tipos GraphQL sobre `Organizacion`; las cuotas (pagar un crédito en partes con fechas fijas) no existen: hoy un crédito tiene un solo vencimiento y se paga en los pagos que haga falta. Tampoco hay un concepto `Foto` en `Producto`: el producto no guarda imagen.
