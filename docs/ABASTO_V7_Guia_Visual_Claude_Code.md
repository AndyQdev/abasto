# ABASTO · Versión 7 «Halo» — Especificación visual para Claude Code

## Objetivo

Reproducir con la máxima fidelidad el diseño de las imágenes adjuntas de la **versión 7** del panel web mayorista de Abasto. Las referencias muestran **Pedidos, Compras y Productos**; son las fuentes visuales principales para las proporciones, las curvas, los espacios, la composición, los colores y el aspecto de los componentes.

La prioridad absoluta es el **header verde bosque de silueta peculiar**, el **menú horizontal blanco suspendido y superpuesto** y el **dock vertical de accesos rápidos a la derecha**. Estas tres piezas forman la identidad permanente del panel y deben verse iguales en todas las secciones. El contenido interior cambia según la vista, pero la estructura de navegación mantiene su forma.

Este documento describe **qué se debe ver y cómo debe sentirse el producto terminado**. Usa tu criterio y conocimiento del proyecto para resolver la implementación. Conserva las funcionalidades, datos y reglas de negocio existentes. Las imágenes contienen información ilustrativa; no deben sustituir los valores reales del sistema.

## 1. Identidad visual

| Elemento | Identidad |
| --- | --- |
| Verde bosque | `#182D25` — header, dock lateral, texto principal e iconografía oscura |
| Verde lima | `#C9F45A` — navegación seleccionada, botones principales y estados destacados |
| Ámbar cálido | `#FFB454` — pedidos pendientes, advertencias y elementos que requieren atención |
| Fondo general | `#F2F7EB` — verde crema muy claro, sin blanco puro de fondo |
| Tarjetas | Blanco cálido, sombras suaves y bordes de aspecto limpio |
| Tipografía | Plus Jakarta Sans; titulares y cantidades en pesos fuertes, resto legible |

La sensación general es **e-commerce moderno, cálido, amigable y premium**, no un ERP tradicional. Evitar contenedores cuadrados, exceso de líneas divisorias, grises corporativos, degradados decorativos, morados, rosados o azules. Las sombras deben separar delicadamente las superficies sin parecer pesadas.

Referencias de escala visual: tarjetas con esquinas de aproximadamente **26–32 px**; cápsulas y botones con extremos completamente redondos; iconos dentro de discos suaves; separación generosa entre componentes. Las medidas son orientativas: manda la fidelidad respecto de las capturas.

## 2. Header «Halo» — máxima prioridad

Este encabezado NO es una barra rectangular convencional. Es una **gran pieza horizontal verde bosque, flotante, con contorno orgánico y una ondulación inferior controlada**. Debe reconocerse inmediatamente como el header de Abasto.

### Silueta general

- Ocupa casi todo el ancho de la zona superior, dejando una pequeña separación respecto de los bordes de la pantalla.
- Tiene **esquinas exteriores enormemente redondeadas**, como una cápsula ancha y elegante; la altura visual aproximada es de 140–150 px en una referencia de escritorio de 1536 × 1024.
- **Su borde inferior no es una línea recta.** Presenta una curva suave y amplia, con transiciones redondeadas a ambos lados del menú blanco que se superpone. En las imágenes se aprecia cómo el verde bosque parece abrazar al menú suspendido.
- La curva debe ser deliberada y armónica, con pocos cambios de dirección. No agregar ondas pequeñas ni adornos excesivos.
- El header se percibe ligeramente elevado sobre el fondo crema por una sombra muy suave.

### Contenido interior del header

- **Marca a la izquierda:** una cápsula blanca grande, de esquinas muy redondeadas, que se monta parcialmente sobre el verde bosque. Contiene el símbolo lima de Abasto, el nombre **«Abasto»** en verde bosque y la línea **«Panel Mayorista»** debajo. El contenedor blanco contrasta claramente con la forma oscura que queda detrás.
- **Buscador centrado:** campo ancho, blanco crema y totalmente redondeado, con lupa verde bosque y texto «Buscar en Abasto». Una sola búsqueda global en el encabezado; evitar añadir otra que duplique su función sin motivo.
- **Zona derecha:** campana de notificaciones discreta con un pequeño indicador lima, separador visual fino y usuario «Abasto Ventas» con avatar circular claro y desplegable.
- El contenido debe estar alineado con naturalidad, dejando espacio de respiración. No aplastar el logotipo, el buscador o el perfil entre sí.

**Detalle decisivo:** en la implementación final, el borde inferior curvo del header debe conservar su forma en distintas pantallas y anchos de escritorio. No reemplazarlo por una barra rectangular, un simple `border-radius` o un fondo verde plano.

## 3. Navegación principal suspendida

Justo bajo el header, centrado horizontalmente, aparece un **menú blanco en forma de cápsula alargada** que se superpone a la parte inferior de la pieza verde bosque. Esta superposición es parte esencial del diseño.

- La cápsula tiene fondo blanco cálido, extremos muy redondos, sombra suave y una altura visual aproximada de 80–90 px.
- Debe parecer que **flota delante del header**, no que está simplemente colocada en una fila debajo.
- Sus opciones son: **Inicio · Productos · Pedidos · Compras · Clientes · Más**.
- Cada opción presenta un icono lineal sencillo sobre su etiqueta. Iconos y textos están centrados y mantienen el mismo ritmo visual.
- **La sección activa** se convierte en una cápsula verde lima algo más alta y prominente, con texto e icono verde bosque. Parece una pestaña levantada que sobresale levemente del menú blanco.
- Las demás opciones se mantienen blancas, sin bordes gruesos ni colores distractores.
- En Pedidos se selecciona «Pedidos», en Compras se selecciona «Compras», en Productos se selecciona «Productos». La forma general no cambia, solo la posición del resaltado.
- Si se necesitan más secciones del sistema, se agrupan de forma clara bajo «Más» sin destruir la composición ni comprimir los elementos visibles.

El efecto final debe ser **una pieza blanca suspendida dentro de la silueta verde**, con una selección lima tridimensional solo por elevación, proporción y sombra sutil (sin gráficos 3D).

## 4. Dock lateral derecho de accesos rápidos

No hay sidebar principal a la izquierda. En su lugar existe un **dock vertical compacto en el extremo derecho**, separado ligeramente del borde, que permanece disponible mientras se trabaja.

- Forma de cápsula vertical alta, verde bosque, aproximadamente 85–95 px de ancho en escritorio, con extremos profundamente redondeados.
- Alberga accesos rápidos a **Alertas, WhatsApp, Agenda, Reportes y Ayuda**, cada uno con icono oscuro dentro de un disco lima claro y una etiqueta blanca pequeña debajo.
- Los elementos se distribuyen con espacios generosos y alineación central.
- Las alertas pueden llevar una pequeña burbuja ámbar o naranja con cantidad; los accesos pueden tener un discreto punto lima de actividad.
- En el costado izquierdo, a media altura, aparece una **pequeña lengüeta lima que sobresale**, de forma redondeada, con doble flecha de plegado. Es otro rasgo visual muy característico de esta versión.
- No debe parecer un segundo menú de navegación ni ocultar la información de las tarjetas. Su papel son las herramientas rápidas y notificaciones.
- Al contraerse, conservar la identidad de cápsula y una forma evidente de volver a expandirlo.

## 5. Distribución del contenido

- Fondo continuo verde crema `#F2F7EB`.
- El contenido comienza **debajo del menú flotante**, con suficiente separación para no quedar atrapado detrás de la navegación.
- Título principal grande, verde bosque, alineado a la izquierda; subtítulo breve debajo. A la derecha puede aparecer un contador en una cápsula blanca.
- Filtros en chips blancos o lima claro; botones de acción primaria lima con texto bosque.
- Tarjetas blancas de gran radio, fotografía de producto cuando corresponda, sombras de dos niveles muy sutiles y mucha claridad tipográfica.
- Reservar espacio a la derecha para el dock: ninguna tarjeta, etiqueta o botón debe quedar debajo de él.
- El panel sigue siendo una herramienta de trabajo con información abundante; **redondeado y cálido no significa inflado ni desperdiciar espacio**.

## 6. Vista «Pedidos»

Reproducir el enfoque de la captura de Pedidos:

- Título «Pedidos» y subtítulo operativo.
- Contadores destacados «Por confirmar», «En preparación» y «En camino» en tres tarjetas horizontales grandes.
- Filtros compactos, por ejemplo «Todos», «Hoy» y «Urgentes», con la opción activa en lima.
- Tres columnas con cabeceras redondeadas y colores suaves: **Por confirmar** (ámbar), **Preparando** (lima suave) y **En reparto** (verde suave).
- Cada pedido es **una tarjeta independiente de altura compacta**, aunque incluya muchos productos. Mostrar código como `A-1342`, tiempo, negocio, barrio, importe en Bs, estado del pago, miniaturas superpuestas y resumen «+11 productos».
- Mostrar un único botón de acción claramente visible según el estado: «Confirmar», «Preparar» o «Marcar entregado» cuando corresponda.
- La lista completa de productos pertenece al detalle del pedido, no a una tarjeta enorme dentro del tablero.
- Mantener legibilidad y consistencia incluso con muchos pedidos.

## 7. Vista «Compras»

Reproducir el enfoque de la captura de Compras:

- Título «Compras de hoy», subtítulo y fecha.
- Tres tarjetas de valores: **Vas a gastar**, **Vas a cobrar**, **Ganancia estimada**. La última puede resaltarse con verde suave si es positiva.
- Filtros por mercado o zona, como «Todos», «Los Pozos», «La Ramada» y «Mutualista». Botón «Imprimir lista» oscuro y redondeado.
- Una tarjeta grande por puesto, proveedor o distribuidora. Encabezado pastel con nombre y ubicación, contador «3 de 7 comprados» y barra de progreso.
- Productos en filas tipo checklist con casilla de selección grande, miniatura, nombre, unidad y cantidad, código de pedido asociado e importe.
- Casillas marcadas en lima; las pendientes deben distinguirse claramente.
- Advertencias de margen negativo visibles en rojo, pero sin llenar el panel de alertas.
- Subtotal y acción «Ver detalles» al pie de cada tarjeta.

## 8. Vista «Productos» — referencia más reciente

La imagen de Productos adjunta es la referencia visual directa del catálogo:

- Título «Productos», subtítulo «Tu catálogo mayorista, siempre actualizado» y contador de productos/sin stock en cápsula blanca.
- Chips de categorías: «Todos», «Harinas», «Aceites», «Granos», «Carnes», «Bebidas» o las categorías reales del sistema.
- Filtro secundario **«Mostrar a»** para segmentos de clientes como Tiendas, Panaderías, Pensiones y Hogar.
- Botón principal **«+ Nuevo producto»** en lima vivo, extremo completamente redondeado.
- Selector **«Cuadrícula / Lista»**, con la vista activa destacada en verde bosque.
- En escritorio, vista de cuadrícula de **tres columnas** con tarjetas blancas grandes y redondeadas. Cada tarjeta presenta fotografía realista sobre un fondo claro a la izquierda y, a la derecha, información legible.
- Nombre y presentación bien jerarquizados; tres escalones de precio mayorista en líneas cortas, cada uno con una mini cápsula de volumen: «Unidad», «3+», «10+», «12+» o el tramo real correspondiente. Precios en formato «Bs 98,00».
- Etiqueta «Activo» cuando corresponda, interruptor visual de disponibilidad y botón «Editar» de contorno bosque en la parte inferior.
- Productos sin stock atenuados, con etiqueta «Sin stock» y controles que comuniquen claramente su estado.
- Precios pendientes de revisar con pequeño aviso ámbar «Precio por revisar».
- El catálogo se ve como un sistema de gestión, **no como una tienda con botones «Agregar al carrito»**.

## 9. Comportamiento visual y consistencia

- La marca, la curva del header, el menú blanco suspendido y el dock derecho son **componentes visuales constantes** entre todas las vistas.
- Al cambiar de sección, solo se mueve la cápsula lima de selección y cambia el contenido.
- Estados de hover, foco y selección con realce suave, sin cambios bruscos de tamaño ni animaciones exageradas.
- Desplegables, filtros, botones y tarjetas deben mantener el lenguaje de bordes redondeados y contraste alto.
- Los datos del proyecto son la fuente de verdad. Los nombres, cifras, estados y fotografías de las referencias son ejemplos de presentación.
- En pantallas de escritorio más estrechas, evitar superposiciones: adaptar tamaño y separación de las piezas sin perder la identidad del header. Dar prioridad a navegación usable y texto legible.
- Conservar todas las acciones reales existentes y su semántica. No crear acciones decorativas que no funcionen.

## 10. Criterios de aceptación visual

Antes de considerar concluido el rediseño, comprobar:

1. **El header tiene la misma silueta curva/ondulada que la referencia, no una barra convencional.**
2. La cápsula blanca de navegación está **suspendida y superpuesta** al header, con sombra y selección lima elevada.
3. La marca se encuentra en su cápsula blanca de la esquina superior izquierda y el buscador está centrado dentro del header oscuro.
4. El dock derecho es estrecho, vertical, profundamente redondeado y tiene su pequeña lengüeta lima de plegado.
5. Al navegar entre Pedidos, Compras y Productos, esos elementos mantienen la misma geometría y solo cambia la selección.
6. Los colores, tipografía, radios, sombras y espaciados se parecen a las imágenes, no a un tema genérico.
7. Ningún elemento queda oculto debajo del menú suspendido o del dock derecho.
8. Los componentes internos de cada vista son fáciles de entender y muestran los datos reales del negocio.

## Instrucción final

**Toma las imágenes adjuntas como referencia visual prioritaria y reproduce especialmente el header Halo y su menú flotante con la mayor fidelidad posible.** Usa libertad técnica para integrarlo al proyecto existente, sin perder su funcionamiento. Si un detalle es difícil de apreciar en el texto, prevalece la forma visible en las imágenes. El resultado debe sentirse como una misma aplicación de Abasto en todas las secciones.
