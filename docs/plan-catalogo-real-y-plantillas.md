# Plan · Catálogo real por área y primera receta automática

Pedido de Andrés (02/11/2026). Enfoque: Santa Cruz de la Sierra. Se suma a `docs/plan-mi-negocio.md`.

**Objetivo:** al registrarse, el productor elige su área y ve su primera receta ya llena, con cantidades que puede
editar ahí mismo. Con eso sabe qué le falta comprar en Abasto. Cada cliente ve solo lo que le sirve: un panadero no ve yogurt.

## Qué es verificado y qué no

- **Qué se vende más:** viene del estudio del Instituto Cruceño de Estadística [ICE, 2021, 200 personas, área
  metropolitana, muestreo por cuotas, error aprox. 6 %]. Sirve como orientación, no como censo.
- **No hay datos públicos** de cuántos negocios existen por rubro en Santa Cruz. Las áreas salen de dónde compra la gente
  según el ICE, más el criterio propio para la pollería.
- **Las cantidades son un punto de partida editable,** no una fórmula comprobada en un negocio real. Etiquetas:
  `[F]` publicada en la fuente, `[A]` escalada o ajustada desde la fuente, `[E]` estimada, sin fuente directa.
- **Los precios no se pudieron cotizar por internet.** Todo producto nuevo sale con `precioPorConfirmar`. El nombre del
  producto es real; la marca se pone solo si está confirmada.

## El registro, paso a paso

1. Celular → código → nombre (como está).
2. «¿Para qué compras?»: Mi hogar / Tienda de abarrotes / Productor.
3. Según el tipo:
   - **Mi hogar:** sin pasos extra. Sigue a la dirección.
   - **Productor:** «¿Qué haces?» (las 6 áreas) → **«Arma tu primera receta»**.
   - **Tienda:** **«Arma tu primer estante»** (ver abajo).
4. Dirección → Inicio.

Las recetas y el estante se pueden **saltar** («Lo hago después») para no perder el registro, y quedan en «Mi negocio».

### «Arma tu primera receta» (productor)

1. Elige el producto. Si el área tiene varios, salen tarjetas con foto: «¿Qué preparas más?». En pensión se pueden marcar
   varios platos, y cada uno crea su receta.
2. Ve **la lista ya llena**, agrupada («Para la masa», «Para el relleno»), con cuánto rinde («Salen 50 salteñas»).
3. Edita en la misma lista: cambia cantidades, quita o agrega ingredientes, y cambia el rinde.
4. Al guardar ve: **«Cada salteña te cuesta Bs X»** (con los precios de referencia) y **«Para esta receta te falta esto»**,
   con el botón **«Pedir lo que falta»**, que elige la presentación (1 arroba, 1 balde…) y lo lleva al carrito.

**Cambio de código clave:** hoy la receta exige que el insumo ya esté en el inventario. Debe poder crearse con
insumos en cero: la plantilla crea el artículo (`productoId` del catálogo, existencia 0) y la receta. El agua no se compra:
sale en la receta sin artículo ni costo. Todo lo demás se puede pedir a Abasto.

### «Arma tu primer estante» (tienda)

Es lo mismo que la receta, pero para revender. Tu respuesta a «¿cuál sería el siguiente paso?»:

1. Sale la lista de lo que más se repone (arroz, azúcar, aceite, fideo, harina, sal, huevo, leche, gaseosas, detergente, papel…), ya marcada.
2. La tienda quita lo que no vende y dice cuántas pide.
3. Ve **«Si lo vendes al precio sugerido, ganas Bs X»** (margen editable; 20 % por defecto, a confirmar con Andrés).
4. Botón: **«Pedir este estante»**. Cuando llega, entra solo al inventario, con precio de venta sugerido.

## Las 6 áreas (reemplazan salteñería, panadería y pensión)

| Clave | Nombre | Plantillas | Por qué entra |
|---|---|---|---|
| `salteneria` | Salteñería y empanadas | Salteña, empanada de queso | Empanadas 78 % y salteña 65 % las comen al menos 1 vez al mes [ICE] |
| `panaderia` | Panadería y pastelería | Pan batido, queque | Queque 61 % [ICE]; el pan es de consumo diario |
| `horneados` | Horneados cruceños | Cuñapé, sonso, masaco | Cuñapé 78 %, el horneado estrella: 98 % lo consume [ICE] |
| `pension` | Pensión y restaurante | Majadito, sopa de maní, locro, keperí, rapi al jugo, pique macho | El 39 % de los platos típicos se compra aquí [ICE] |
| `polleria` | Pollería y comida rápida | Pollo frito, hamburguesa, salchipapa | Sin dato cruceño; criterio propio. A validar en la calle |
| `puesto` | Puesto de comida (agachao) | Anticucho, asadito con yuca, pacumuto | El 17 % de los platos típicos se compra en puestos [ICE] |

Lo que trae el ICE para pensión (consumo mensual y compra en pensión o restaurante): majadito 79 % y 53 %, sopa de maní 70 % y 48 %, locro 66 % y
21 % (65 % en casa), keperí 52 % y 54 %, rapi al jugo: 52 % en pensión. Pique macho no está en el estudio; lo sumo por criterio propio.

**Compatibilidad:** los valores actuales se conservan. Hay que revisar el `subtipo` en Catálogo (`organizaciones.negocio`, GraphQL) y `SUBTIPOS` en `packages/comercio/src/negocios.ts`.

## Qué ve cada uno en el Inicio

Hoy el perfil filtra por rubro y por palabra del nombre: `COCINA` incluye «Huevos y lácteos», y por eso al panadero le puede salir yogurt.

**Cambio:** cada producto lleva **`usos`**: lista de áreas donde se muestra (`hogar`, `tienda` y las 6 áreas).
- El cliente solo ve productos con su uso. Buscar sí encuentra todo.
- Se edita en el Panel (`http://localhost:5170/`, `ventas@abasto.bo`), con filtro por área. Así Abasto decide qué mostrar, sin tocar código.
- Secciones del Inicio del productor: **«Para tu receta de salteña»** (los insumos de sus recetas, primero), «Lo que más se pide en tu rubro» y «Tu pedido de la semana».
- Una foto o ilustración por producto; ningún producto sin imagen en el Inicio.

## Catálogo real: productos que hay que cargar

Áreas: **S** salteñería, **P** panadería, **H** horneados, **C** pensión, **R** pollería, **A** puesto, **T** tienda, **M** hogar.
«Ya» = existe en la semilla. Lo demás es nuevo, con `precioPorConfirmar`. Marcas confirmadas por fuentes o por la semilla anterior: Famosa, Guabirá, Fino, Karina, Gordito, Regia, Caisy, Don Vittorio, PIL.

### Harinas y panificación
| Producto | Usos | Estado |
|---|---|---|
| Harina de trigo · quintal 46 kg | S P | Ya (AB-101) |
| Harina de trigo · arroba 11,5 kg | S P R T | Ya (AB-102) |
| Harina Famosa 1 kg | T M | Ya (AB-004) |
| Azúcar · quintal 46 kg | S P H | Ya (AB-103) |
| Azúcar · arroba 11,5 kg | S P H C T | Nuevo |
| Azúcar Guabirá 1 kg | T M | Ya (AB-002) |
| Levadura seca instantánea 500 g | P | Ya (AB-104) |
| Polvo de hornear 1 kg | P H S | Ya (AB-105) |
| Almidón de yuca · arroba 11,5 kg | H | Nuevo |
| Almidón de yuca 1 kg | H T M | Nuevo |
| Maicena 1 kg | P R | Nuevo |
| Pan molido 1 kg | R A C | Nuevo |
| Esencia de vainilla 500 ml | P | Nuevo |
| Gelatina sin sabor 500 g | S | Nuevo |

### Aceites y grasas
| Producto | Usos | Estado |
|---|---|---|
| Manteca vegetal · balde 15 kg (Karina o Gordito) | S P H | Ya (AB-106) |
| Manteca Karina 1 kg | S H T M | Nuevo |
| Margarina Regia 1 kg | P H | Nuevo |
| Aceite vegetal · bidón 5 L | S C R A | Ya (AB-107) |
| Aceite vegetal · bidón 20 L | R A C | Nuevo |
| Aceite Fino 900 ml | T M | Ya (AB-005) |

### Granos, cereales y pastas
| Producto | Usos | Estado |
|---|---|---|
| Arroz · quintal 46 kg | C R A T | Ya (AB-108) |
| Arroz · arroba 11,5 kg | C R A T M | Ya (AB-109) |
| Arroz Caisy Grano de Oro 1 kg | T M | Ya (AB-001) |
| Fideo tallarín · bolsa 5 kg | C T | Ya (AB-110) |
| Fideo Don Vittorio 500 g | T M | Ya (AB-003) |
| Maní crudo pelado 1 kg | C | Nuevo |
| Arveja seca 1 kg | S C | Nuevo |

### Condimentos y conservas
| Producto | Usos | Estado |
|---|---|---|
| Sal fina · bolsa 25 kg | S P H C R A | Nuevo |
| Sal fina Lobos 1 kg | T M | Ya (AB-007) |
| Urucú (achiote) molido 500 g | S C | Nuevo |
| Ají colorado molido 1 kg | S C A | Ya (AB-111) |
| Comino molido 500 g | S C R A | Ya (AB-112) |
| Pimienta negra molida 500 g | S C R A | Ya (AB-113) |
| Orégano seco 500 g | S C | Ya (AB-114) |
| Ajo en polvo 500 g | R | Nuevo |
| Vinagre 5 L | C A R | Nuevo |
| Aceitunas verdes · balde 5 kg | S | Nuevo |
| Pasas de uva 1 kg | S | Nuevo |
| Mayonesa · balde 3 kg | R | Nuevo |
| Salsa de tomate (kétchup) · bidón 3 kg | R | Nuevo |
| Mostaza · bidón 3 kg | R | Nuevo |

### Huevos, lácteos y queso
| Producto | Usos | Estado |
|---|---|---|
| Huevo · maple de 30 | S P H C R A T M | Ya (AB-115) |
| Leche PIL fresca 900 ml | P H R T M | Ya (AB-017) |
| Mantequilla PIL con sal 200 g | H T M | Ya (AB-040) |
| Queso criollo · 1 kg (frío) | S H C A | Nuevo |
| Yogurt y Biogurt PIL | T M | Ya (solo tienda y hogar) |

### Verduras y tubérculos
| Producto | Usos | Estado |
|---|---|---|
| Papa · arroba 11,5 kg | S C R A M | Ya (AB-116) |
| Cebolla · arroba 11,5 kg | S C R A M | Ya (AB-117) |
| Ajo · 1 kg | S C A | Ya (AB-118) |
| Tomate · arroba 11,5 kg | C R | Nuevo |
| Zanahoria · arroba 11,5 kg | C | Nuevo |
| Pimentón · 5 kg | C | Nuevo |
| Locoto · 1 kg | C | Nuevo |
| Yuca · arroba 11,5 kg | H C A M | Nuevo |
| Plátano verde · cabeza | H C | Nuevo |
| Plátano maduro · cabeza | C | Nuevo |
| Lechuga · 12 unidades | R | Nuevo |

### Carnes (frío: ver la decisión de abajo)
| Producto | Usos | Estado |
|---|---|---|
| Charque de res · 1 kg (no necesita frío) | H C | Nuevo |
| Carne de res para guiso · 1 kg | S C A | Nuevo |
| Carne molida · 1 kg | R A | Nuevo |
| Lomo de res · 1 kg | C | Nuevo |
| Corazón de res · 1 kg | A | Nuevo |
| Pollo entero · 1 u. | S C R | Nuevo |
| Patas de pollo · 1 kg | C | Nuevo |
| Gallina criolla · 1 u. | C | Nuevo |
| Chorizo · 1 kg | C | Nuevo |
| Salchicha Viena · 1 kg | C R | Nuevo |

### Descartables e insumos de local
| Producto | Usos | Estado |
|---|---|---|
| Bolsas plásticas medianas · 100 | S P H C R A T | Ya (AB-119) |
| Envase de plastoformo con tapa · 100 | C R A | Ya (AB-120) |
| Servilletas · 500 | S C R A | Ya (AB-121) |
| Vasos descartables 250 ml · 100 | C R A | Ya (AB-122) |
| Pan de hamburguesa · 50 u. | R | Nuevo |
| Palitos de anticucho · 100 | A | Nuevo |
| Bolsas de papel para pan · 500 | P H | Nuevo |
| Gas licuado (no se vende: solo como costo a mano) | — | No cargar |

Bebidas, limpieza, higiene, galletas y dulces de la semilla actual se quedan con usos `T M`; los productores no los ven.

**Limpieza del catálogo:** los productos de otros mayoristas y los de `catalogo:semilla` son para pruebas. No pueden salir en la app ni en el Panel de `ventas@abasto.bo`, pero sí seguir disponibles para e2e y para los casos de uso del parcial. Revisa eso antes de quitar nada.

## Plantillas de receta

Las cantidades por lote se escriben en kg, g, L y u. El insumo es genérico (`harina de trigo`): el planificador elige la presentación del catálogo.

### Salteñería y empanadas

**Salteña de carne · salen 50** (base: 2 kg de harina; bollos de ~90 g)
- Para la masa: harina de trigo 2 kg [F1] · manteca 460 g [F1] · azúcar 400 g [A: las fuentes van de 300 a 500 g] · agua 700 ml [A] · huevo 4 u. [A] · sal 30 g [F1] · urucú 30 g [F1]
- Para el jigote: carne de res 2 kg [A] · papa 1 kg [E] · cebolla 1 kg [E] · arveja 250 g [E] · ají colorado molido 150 g [E] · gelatina sin sabor 40 g [F1] · caldo (agua) 2 L [F1] · comino 10 g [E] · pimienta 10 g [E] · orégano 10 g [E] · ajo 50 g [E] · sal 30 g [E] · aceite 100 ml [E]
- Para adentro: huevo duro 8 u. [F1] · aceitunas 50 u. (~250 g) [F1] · pasas 200 g [A, F2]

Variante pollo: cambia la carne por pollo entero 3 u. [E].

**Empanada de queso · salen 50**
- Harina de trigo 2 kg [E] · manteca 400 g [E] · azúcar 100 g [E] · polvo de hornear 20 g [E] · huevo 3 u. [E] · sal 30 g [E] · agua 700 ml [E] · queso criollo 1,5 kg [E]

### Panadería y pastelería

**Pan batido (marraqueta) · salen ~300, con 1 arroba de harina**
- Harina de trigo 11,5 kg [A, F3] · agua 6,9 L [A, F3] · sal 230 g [A, F3] · levadura seca 170 g [A, F3] · manteca 230 g [E]
- La fuente es chilena (1 kg de harina, 600 ml de agua, 20 g de sal, 15 g de levadura), sin manteca. El rinde es [E]: ~60 g por pan.

**Queque · salen ~40 porciones**
- Harina de trigo 1 kg [E] · azúcar 1 kg [E] · margarina 1 kg [E] · huevo 18 u. [E] · polvo de hornear 30 g [E] · leche 200 ml [E] · esencia de vainilla 20 ml [E]

### Horneados cruceños

**Cuñapé · salen 50**
- Almidón de yuca 1,1 kg [A, F4] · queso criollo 1,1 kg [A, F4, F5] · huevo 4 u. [A, F4] · mantequilla 90 g [A, F4] · sal 30 g [A, ajusta según el queso] · leche 550 ml [A, F4]

**Sonso · salen 20**
- Yuca 2,5 kg [E] · queso criollo 800 g [E] · manteca 120 g [E] · leche 200 ml [E] · sal 20 g [E]

**Masaco de plátano · salen 20**
- Plátano verde 3 kg [E] · charque 500 g [E] · manteca 200 g [E] · sal 20 g [E]

### Pensión y restaurante (cada plato · salen 20 porciones)

**Majadito**
- Charque 2 kg [A, F5, F6] · arroz 2 kg [A, F6] · aceite 400 ml [A, F5] · cebolla 1 kg [A] · pimentón 500 g [A] · tomate 1 kg [A] · ajo 60 g [A] · urucú 30 g [A, F5] · plátano maduro 10 u. [A] · huevo 20 u. [A, F5] · sal 40 g [E] · pimienta 10 g [E] · agua 6 L [A]

**Sopa de maní**
- Maní crudo 400 g [A, F7, F8] · patas de pollo 20 u. [A, F7] · carne de res 1,5 kg [A, F7] · cebolla 600 g [A] · zanahoria 1 kg [A, F7] · pimentón 300 g [A] · fideo 400 g [A, F7] · papa 3 kg [A, F8] · aceite 1 L [A, para freír las papas] · orégano 15 g [A, F7] · pimienta 10 g [A] · ajo 30 g [A] · sal 40 g [A] · agua 10 L [A, F7]

**Locro de gallina**
- Gallina criolla 3 u. [A, F5] · arroz 1 kg [A, F5] · papa 2 kg [A, F5] · aceite 150 ml [A, F5] · cebolla 500 g [E] · pimentón 300 g [E] · urucú 15 g [E] · huevo 20 u. [E] · sal 40 g [E] · agua 15 L [A, F5]

**Keperí**
- Carne de res 5 kg [E] · cebolla 1 kg [E] · ajo 60 g [E] · ají colorado molido 100 g [E] · comino 20 g [E] · vinagre 200 ml [E] · aceite 200 ml [E] · sal 50 g [E]
- Acompañamiento: arroz 1,5 kg [E] · queso criollo 500 g [E] · yuca 3 kg [E]

**Rapi al jugo**
- Carne de res 5 kg [A, F5] · cebolla 2 kg [A, F5] · tomate 5 kg [A, F5] · pimentón 1 kg [A, F5] · zanahoria 1,5 kg [A, F5] · ajo 60 g [A, F5] · aceite 200 ml [E] · urucú 15 g [E] · comino 15 g [E] · pimienta 10 g [E] · sal 50 g [E]
- Acompañamiento: arroz 1,5 kg [E] · queso criollo 500 g [E] · yuca 3 kg [E]

**Pique macho**
- Lomo de res 3,3 kg [A, F9] · chorizo 1 kg [A, F9] · salchicha Viena 1 kg [A, F9] · papa 3,3 kg [A, F9] · aceite 2 L [A] · cebolla 1,3 kg [A, F9] · tomate 1 kg [A, F9] · huevo duro 7 u. [A, F9] · locoto 7 u. [A, F9] · sal 40 g [E] · pimienta 10 g [E]

### Pollería y comida rápida (sin receta boliviana publicada: todo [E] o de referencia peruana)

**Pollo frito · salen 40 porciones**
- Pollo entero 10 u. · harina de trigo 2 kg · maicena 500 g · huevo 12 u. · leche 1 L · sal 200 g · pimienta 30 g · comino 30 g · ajo en polvo 50 g · aceite 10 L · papa 11,5 kg · arroz 3 kg

**Hamburguesa · salen 50**
- Carne molida 5 kg · pan de hamburguesa 50 u. · cebolla 1 kg · tomate 2 kg · lechuga 6 u. · huevo 10 u. · pan molido 300 g · sal 60 g · pimienta 15 g · mayonesa 500 g · kétchup 500 g · mostaza 200 g

**Salchipapa · salen 20**
- Papa 6 kg · salchicha Viena 3 kg · aceite 3 L · sal 40 g · mayonesa 300 g · kétchup 300 g

### Puesto de comida

**Anticucho · salen 30 palitos** (todo [E])
- Corazón de res 5 kg · papa 3 kg · ají colorado molido 300 g · comino 20 g · ajo 100 g · vinagre 300 ml · aceite 300 ml · sal 50 g · palitos 30 u.

**Asadito con yuca · salen 40** (base F5: 500 g de carne y 500 g de yuca rallada; rinde [E])
- Carne molida 2,5 kg [A] · yuca rallada 2,5 kg [A] · huevo 5 u. [A] · cebolla 500 g [A] · ajo 25 g [A] · pan molido 300 g [A] · aceite 3 L [E] · sal 40 g [E] · pimienta 10 g [E] · yuca para servir 3 kg [E]

**Pacumuto · salen 20 porciones** (todo [E])
- Carne de res 5 kg · comino 20 g · ajo 60 g · sal 50 g · aceite 200 ml · arroz 1,5 kg · queso criollo 500 g · yuca 3 kg · cebolla 500 g · tomate 500 g

## Estante de la tienda (plantilla)

Arroz Caisy 1 kg · azúcar Guabirá 1 kg · aceite Fino 900 ml · fideo Don Vittorio 500 g · harina Famosa 1 kg · sal 1 kg · huevo (maple) · leche PIL · yogurt PIL · Coca-Cola 2 L · Simba 2 L · agua Vital 2 L · detergente Skip · lavandina · papel higiénico · jabón Protex · galletas Mabel's · chocolate Para Ti · bolsas plásticas.

## Fases sugeridas

1. **Datos:** `usos` en Catálogo y GraphQL, y los 43 productos nuevos en `SembrarAbasto` (quedan 92 en total), con imagen. Editar `usos` en el Panel. Probar que el panadero no vea yogurt.
2. **Plantillas:** `packages/comercio/src/mi-negocio/plantillas.ts` con esta lista (cada insumo con su código del catálogo y su etiqueta F/A/E) y pruebas: todo insumo vendible existe en el catálogo.
3. **Receta con insumos en cero** en el motor (hoy exige inventario).
4. **Registro:** las 6 áreas, «Arma tu primera receta» editable, «Pedir lo que falta», y «Arma tu primer estante».
5. **Inicio:** secciones por `usos` y «Para tu receta».
6. **Pruebas:** e2e por área en el emulador y todos los flujos ya existentes en verde.

## Decisiones para Andrés

1. **Carne, pollo y queso: DECIDIDO (Andrés, 02/11): se cargan como todos los demás, sin sección especial.** Abasto no tiene stock: todo es bajo pedido; cuando alguien pide, se consigue con un mayorista y se entrega. Por eso ningún ingrediente de las plantillas sale como «Esto lo compras tú» salvo el agua, que no se compra. Riesgo que queda a cargo de la operación: la entrega de lo que necesita frío.
2. **Pollería:** entra sin datos cruceños. Hay que validarla en la calle.
3. **Margen sugerido de la tienda:** 20 %, editable.

## Fuentes

- [ICE] Instituto Cruceño de Estadística, *Hábitos de consumo de comidas típicas en Santa Cruz*, 2021: https://ice.santacruz.gob.bo/uploads/ICE_habitos_consumo_comidas_tipicasensantacruz_ded1e254ba.pdf
- [F1] Diario Correo, salteña (2 kg de harina, ~50 bollos): https://diariocorreo.pe/gastronomia/peru-vs-bolivia-empanada-peruana-vs-saltena-boliviana-conoce-la-receta-nndc-noticia/
- [F2] Chipa by the Dozen, salteñas: https://chipabythedozen.com/en/saltenas-bolivian-empanadas/
- [F3] El Dínamo, marraqueta: https://www.eldinamo.cl/buen-dato/2024/05/14/marraqueta-es-elegida-como-el-tercer-mejor-pan-del-mundo-esta-es-la-receta-para-prepararlo/
- [F4] Chipa by the Dozen, cuñapé: https://chipabythedozen.com/cunape-al-horno-baked-cunape/
- [F5] Los Tiempos, *Con sabor a Oriente* (majadito, locro, rapi, asadito): https://www.lostiempos.com/node/392971 · cuñapé: https://www.lostiempos.com/node/386252
- [F6] Cadena 3, majadito: https://www.cadena3.com/noticia/recetas/majadito-boliviano-con-charque-un-clasico-que-conquista-corazones_478121
- [F7] Chipa by the Dozen, sopa de maní: https://chipabythedozen.com/en/sopa-de-mani-peanut-soup/
- [F8] MDZ, sopa de maní: https://www.mdzol.com/sociedad/2019/8/23/sopa-de-mani-otros-secretos-bolivianos-que-esconde-mendoza-41214.html
- [F9] Chipa by the Dozen, pique macho: https://chipabythedozen.com/en/wprm_print/pique-macho-bolivian-recipe
- Marcas de Fino, Karina, Gordito y Regia: https://en.wikipedia.org/wiki/Industrias_de_Aceite

## Cómo quedó (02/11)

| Fase | Dónde está |
|---|---|
| 1 · Datos | `Producto.usos` y `Organizacion.dePrueba` en Catálogo (dominio, Mongo, GraphQL). `SembrarAbasto`: 138 productos (49 de antes, 43 del plan y 46 sumados para cubrir mejor las áreas, la tienda y el hogar), todos BAJO_PEDIDO, con precio por confirmar e imagen (`database/fotos-abasto`). Volver a sembrar no pisa los usos editados en el Panel (salvo `--usos`). Panel › Productos: filtro por área y un toque prende o apaga cada uso. La app oculta a los mayoristas de prueba (`sinPruebas`). |
| 2 · Plantillas | `packages/comercio/src/mi-negocio/plantillas.ts`: 20 recetas (la salteña de pollo es la variante) y el estante de la tienda. Cada insumo genérico trae los códigos que lo venden, de la presentación más chica a la más grande, con su origen F/A/E. La prueba lee la semilla de Catálogo: todo insumo existe, viene en una medida que sirve y se le muestra a su área. |
| 3 · Receta en cero | `primera-receta.ts`: `primeraReceta` crea el artículo de cada insumo con existencia 0 (`abasto:<código>`, el mismo que usa la compra) y la receta en la unidad del artículo; `preciosDeReferencia` da el costo antes de comprar (`costoDeReceta` y `planificar` lo aceptan); `resumenDeRecetas` suma lo que falta de varias recetas. `primer-estante.ts`: el estante con su ganancia y el precio de venta que queda guardado en el artículo. |
| 4 · Registro | `Negocio.tsx` (las 6 áreas en tarjetas) y `PrimerPaso.tsx` («Arma tu primera receta», «Arma tu primer estante»). El catálogo y el inventario se cargan desde el registro (`App.tsx`). Saltar deja el acceso en Mi negocio («Usar una receta lista», «Arma tu primer estante»). |
| 5 · Inicio | `seccionesDelNegocio` filtra por `usos`: «Para tu receta de…» (los insumos de sus recetas), «Lo que más se pide en tu rubro» (lo que llevan las plantillas de su área), «Para llevar» y «También te puede servir». «Tu pedido de la semana» sigue en el Carrito (pedido de Andrés del 02/11). |

**Quedó afuera, a decidir:**
- El agua sale en la plantilla, pero no se guarda en la receta: el modelo de Cobros pide un artículo por insumo. Para guardarla hace falta un campo de notas en la receta.
- La ganancia editable se aplica al primer estante (queda como precio de venta de cada artículo). El margen por defecto del negocio sigue fijo en 20 % para la tienda y 50 % para el productor.
- Las ilustraciones de producto son 3D sobre fondo blanco, como las fotos; cuando haya fotos propias se reemplazan con el mismo nombre de archivo.
