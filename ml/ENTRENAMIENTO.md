# Qué está entrenado en Abasto y de dónde salieron los datos

Dueño: Jhoel. Actualizado: 02/11/2026. Antes de entrenar algo nuevo, lee esto y súmale una fila a «Historial».

## 1. Modelos que van hoy en la app (teléfono)

Todos usan **una sola red**: MobileNetV3Small preentrenada en ImageNet (TensorFlow/Keras) exportada a
TFLite float16 (`apps/app/assets/modelos/productos.tflite`, ~1,9 MB). Una pasada por la foto da un **vector de 576
números** (embedding); ese vector se compara por similitud coseno con los vectores guardados (búsqueda vectorial local,
sin internet).

| Qué reconoce | Archivo en la app | Cómo se generó | Datos | Resultado |
|---|---|---|---|---|
| **117 de los 138 productos** del catálogo de Abasto | `vectores.json`, `etiquetas.json` | `ml/src/abasto_ml/vision/catalogo.py` | 198 fotos reales: las 27 fotos de tienda del catálogo + fotos de referencia (§5) + 43 de Wikimedia Commons revisadas a mano; las ilustraciones 3D genéricas **no** se usan. 6 vistas por foto | top-1 702/702 con fotos de celular **simuladas** (optimista: salen de las mismas fotos) |
| Clasificador de los 117 productos (deep learning, TensorFlow) | dentro de `productos.tflite` | `catalogo.py` › `entrenar_clasificador` (transfer learning: base congelada, capa densa entrenada) | 40 fotos de celular simuladas por producto (giro, recorte, luz, desenfoque) | validación 100 % (mismo aviso) |
| **5 platos** bolivianos | `platos.json`, `metricas-platos.json` | `ml/src/abasto_ml/vision/platos.py` (vector promedio por plato) | **Wikimedia Commons**, ver §2 | **top-1 12/15 = 80 %** con fotos reales que no se usaron |

Detalle de los platos (02/11/2026):

| Plato | Fotos para el vector | Fotos de prueba | Aciertos en prueba |
|---|---|---|---|
| salteña | 37 | 3 | 2 (1 la tomó por silpancho) |
| pique macho | 14 | 3 | 3 |
| salchipapa | 11 | 5 | 4 (1 la tomó por silpancho) |
| silpancho | 8 | 2 | 1 (1 la tomó por salteña) |
| majadito | 8 | 2 | 2 |

Lo que más falta: fotos de **silpancho, majadito y salchipapa** (menos de 15 cada uno). Con 15 fotos de prueba el 80 % es solo una referencia.

## 2. De dónde salieron las fotos

| Fuente | Qué se usó | Licencia | Dónde está la atribución |
|---|---|---|---|
| Tiendas en línea Fidalga, Amarket y Guabirá (fotos de referencia, 02/11/2026: `fotos_referencia.py`, ver §5) | 1 a 3 fotos por producto, solo si coinciden marca, producto y peso | Uso académico; para uso comercial, fotos propias o del proveedor | **`ml/fotos-referencia.csv`** (sitio y enlace de cada foto) |
| Tiendas en línea Fidalga y Amarket (Santa Cruz, 30/10/2026), las cargó Andrés | 27 fotos de productos (640×640, fondo blanco) | Uso de demostración académica; cambiar por fotos propias antes de un uso comercial | `services/catalogo/database/fotos-abasto/LEEME.md` |
| **Wikimedia Commons**, búsqueda por producto genérico (carne, verduras, descartables: `productos_wikimedia.py`, 02/11/2026) | 43 fotos aprobadas de 119 bajadas, para 22 productos que las tiendas en línea no tienen | Libres (CC0, CC BY, CC BY-SA, dominio público) | **`ml/atribuciones-productos.csv`** (autor, licencia, página y `estado`: aprobada, descartada o sin revisar). Solo entran las aprobadas. |
| **Wikimedia Commons**, categorías: `Salchipapas`, `Pique macho`, `Silpancho`, `Majadito`, `Salteñas (Bolivia)` | 93 fotos de platos (versión de 512 px) | Libres: CC BY-SA 4.0 (68), CC BY 2.0 (10), CC BY 3.0 (5), CC0 (3), CC BY-SA 3.0 (3), CC BY-SA 2.0 (2) | **`ml/atribuciones-platos.csv`** (autor, licencia y página de cada foto). Las licencias CC BY y CC BY-SA **exigen citar al autor**: ese archivo va con el proyecto. |

Las fotos no están en el repo (`ml/datos/` está en `.gitignore`). Para volver a bajarlas:
`cd ml && uv run python -m abasto_ml.vision.platos_wikimedia --maximo 40` (solo baja licencias libres, separa 20 % para prueba con un hash repetible y respeta el límite de Wikimedia).

### Fuentes evaluadas y descartadas (02/11/2026)

| Fuente | Por qué no |
|---|---|
| Food-101 (101.000 fotos) | Licencia solo para investigación, ~5 GB y no tiene platos bolivianos. Sirve si se quiere sumar platos internacionales (pizza, hamburguesa). |
| MobileNetV2 Food-101 de STMicroelectronics (.tflite) | Licencia SLA0044 pensada para equipos de ST; además sería un segundo modelo en el teléfono. |
| ViT Food-101 (`nateraw/vit-base-food101`) | 344 MB y no corre con react-native-fast-tflite. |
| Brazilian Food Images (Mendeley, CC BY 4.0) | Útil a futuro para comida en general; no es boliviana. |

## 3. Modelos de lenguaje (no se entrenan: se bajan y se configuran)

En `apps/app/src/ia/local/modelos.json`: LFM2.5-VL 450M, Qwen3.5 0.8B y 2B, Gemma 4 E2B y E4B (GGUF de Hugging Face,
fijados al commit con SHA-256). No se ajustan con datos nuestros; lo que los mejora es el prompt
(`src/ia/entender/con-modelo.ts`) y las recetas de referencia (`src/ia/entender/recetas.json`). Ver `docs/ia-local.md`.

Medido en un TECNO KI5k (4 GB, 02/11/2026): LFM2.5-VL 450M entiende un pedido de texto en ~20 s.

## 4. Cómo sumar más

- **Un plato nuevo:** agrégalo a `PLATOS` en `platos_wikimedia.py` (o pon tus fotos en `ml/datos/platos/entrenar/<plato>/` y algunas en `prueba/<plato>/`), corre `uv run python -m abasto_ml.vision.platos` y suma sus recetas en `recetas.json` con el mismo id.
- **Fotos propias (lo que más sube la precisión):** 30 a 50 por plato, de distintos lugares, ángulos y luces. Guarda autor y licencia en `atribuciones-platos.csv` si no son tuyas.
- **Un producto nuevo del catálogo:** si Catálogo ya tiene su foto, corre `uv run python -m abasto_ml.vision.catalogo`.
- **Más precisión con fotos reales de productos:** `ml/datos/fotos/<CODIGO>/` (20 por producto, revisar con `fotos.py`) y `entrenar.py`.
- Siempre medir con fotos que no se usaron para entrenar y anotar el resultado abajo.

<!-- estado-fotos:inicio -->
## 5. Fotos de los productos del catálogo

Generado por `ml/src/abasto_ml/vision/fotos_referencia.py` el 2026-11-02.

### Fuentes

| Sitio | Resultado |
| --- | --- |
| Fidalga | 868 productos con imagen |
| Amarket | 11918 productos con imagen |
| Hipermaxi | no se pudo usar: HTTP Error 404: Not Found (la home redirige a validate.perfdrive.com (Radware)) |
| PIL | 0 fotos de producto (sin banners); sólo publica banners de categoría, no fotos de envase |
| Guabirá | 21 presentaciones con imagen |
| Sofía | sin sitemap de productos (sólo portada) |

### Productos

| Código | Producto | Foto del catálogo | Fotos de referencia | Estado |
| --- | --- | --- | --- | --- |
| AB-001 | Arroz Caisy Grano de Oro 1 kg | sí | 2 | listo para indexar |
| AB-002 | Azúcar Guabirá 1 kg | sí | 2 | listo para indexar |
| AB-003 | Fideo spaghetti Don Vittorio 500 g | sí | 1 | listo para indexar |
| AB-004 | Harina Famosa 1 kg | sí | 3 | listo para indexar |
| AB-005 | Aceite Fino 900 ml | sí | 2 | listo para indexar |
| AB-007 | Sal fina Lobos 1 kg | sí | 1 | listo para indexar |
| AB-014 | Coca-Cola 2 L | sí | 2 | listo para indexar |
| AB-015 | Agua Vital sin gas 2 L | sí | 2 | listo para indexar |
| AB-016 | Simba piña 2 L | sí | 2 | listo para indexar |
| AB-037 | Mendocina papaya 3 L | sí | 2 | listo para indexar |
| AB-038 | Cerveza Paceña lata 269 ml | sí | 2 | listo para indexar |
| AB-017 | Leche PIL fresca 900 ml | sí | 1 | listo para indexar |
| AB-019 | Leche PIL enriquecida 800 ml | sí | 1 | listo para indexar |
| AB-018 | Yogurt bebible PIL durazno 1 L | sí | 2 | listo para indexar |
| AB-039 | Biogurt PIL frutilla 1 L | sí | 1 | listo para indexar |
| AB-040 | Mantequilla PIL con sal 200 g | sí | 2 | listo para indexar |
| AB-027 | Lavandina Mr. Cloro 1 L | sí | 3 | listo para indexar |
| AB-025 | Detergente Skip 700 g | sí | 1 | listo para indexar |
| AB-026 | Limpia baños Ola Maximus 890 ml | sí | 1 | listo para indexar |
| AB-029 | Papel higiénico Elite Plus · 24 rollos | sí | 1 | listo para indexar |
| AB-041 | Papel higiénico Nacional · 12 rollos | sí | 3 | listo para indexar |
| AB-031 | Pasta dental Colgate Triple Acción 180 g | sí | 1 | listo para indexar |
| AB-030 | Jabón Protex Avena · 3 de 110 g | sí | 1 | listo para indexar |
| AB-032 | Shampoo Sedal Zero Caspa 340 ml | sí | 1 | listo para indexar |
| AB-020 | Galleta wafer Mabel's chocolate 100 g | sí | 2 | listo para indexar |
| AB-021 | Galletas Mabel's Cremositas Max 216 g | sí | 1 | listo para indexar |
| AB-023 | Chocolate Para Ti blanco 100 g | sí | 2 | listo para indexar |
| AB-101 | Harina de trigo · quintal 46 kg | no | 0 (1 dudosa) | dudoso |
| AB-102 | Harina de trigo · arroba 11,5 kg | no | 0 (1 dudosa) | dudoso |
| AB-103 | Azúcar · quintal 46 kg | no | 1 | listo para indexar |
| AB-104 | Levadura seca instantánea 500 g | no | 1 | listo para indexar |
| AB-105 | Polvo de hornear 1 kg | no | 1 | listo para indexar |
| AB-106 | Manteca vegetal · balde 15 kg | no | 1 | listo para indexar |
| AB-107 | Aceite vegetal · bidón 5 L | no | 1 | listo para indexar |
| AB-108 | Arroz · quintal 46 kg | no | 1 | listo para indexar |
| AB-109 | Arroz · arroba 11,5 kg | no | 0 (1 dudosa) | dudoso |
| AB-110 | Fideo tallarín · bolsa 5 kg | no | 1 | listo para indexar |
| AB-111 | Ají colorado molido 1 kg | no | 1 | listo para indexar |
| AB-112 | Comino molido 500 g | no | 1 | listo para indexar |
| AB-113 | Pimienta negra molida 500 g | no | 1 | listo para indexar |
| AB-114 | Orégano seco 500 g | no | 1 | listo para indexar |
| AB-115 | Huevo · maple de 30 | no | 3 | listo para indexar |
| AB-116 | Papa · arroba 11,5 kg | no | 0 (1 dudosa) | dudoso |
| AB-117 | Cebolla · arroba 11,5 kg | no | 1 | listo para indexar |
| AB-118 | Ajo · 1 kg | no | 1 | listo para indexar |
| AB-119 | Bolsas plásticas medianas · paquete de 100 | no | 0 | necesita foto propia |
| AB-120 | Envase de plastoformo con tapa · paquete de 100 | no | 0 | necesita foto propia |
| AB-121 | Servilletas · paquete de 500 | no | 3 | listo para indexar |
| AB-122 | Vasos descartables 250 ml · paquete de 100 | no | 1 | listo para indexar |
| AB-123 | Azúcar · arroba 11,5 kg | no | 1 | listo para indexar |
| AB-124 | Almidón de yuca · arroba 11,5 kg | no | 1 | listo para indexar |
| AB-125 | Almidón de yuca 1 kg | no | 0 (1 dudosa) | dudoso |
| AB-126 | Fécula de maíz (maicena) 1 kg | no | 0 (1 dudosa) | dudoso |
| AB-127 | Pan molido 1 kg | no | 1 | listo para indexar |
| AB-128 | Esencia de vainilla 500 ml | no | 1 | listo para indexar |
| AB-129 | Gelatina sin sabor 500 g | no | 1 | listo para indexar |
| AB-130 | Manteca Karina 1 kg | no | 0 (1 dudosa) | dudoso |
| AB-131 | Margarina Regia 1 kg | no | 1 | listo para indexar |
| AB-132 | Aceite vegetal · bidón 20 L | no | 0 (1 dudosa) | dudoso |
| AB-133 | Maní crudo pelado 1 kg | no | 1 | listo para indexar |
| AB-134 | Arveja seca 1 kg | no | 1 | listo para indexar |
| AB-135 | Sal fina · bolsa 25 kg | no | 0 (1 dudosa) | dudoso |
| AB-136 | Urucú (achiote) molido 500 g | no | 0 | necesita foto propia |
| AB-137 | Ajo en polvo 500 g | no | 1 | listo para indexar |
| AB-138 | Vinagre · bidón 5 L | no | 0 (1 dudosa) | dudoso |
| AB-139 | Aceitunas verdes · balde 5 kg | no | 1 | listo para indexar |
| AB-140 | Pasas de uva 1 kg | no | 0 (1 dudosa) | dudoso |
| AB-141 | Mayonesa · balde 3 kg | no | 1 | listo para indexar |
| AB-142 | Salsa de tomate (kétchup) · bidón 3 kg | no | 0 (1 dudosa) | dudoso |
| AB-143 | Mostaza · bidón 3 kg | no | 1 | listo para indexar |
| AB-144 | Queso criollo · 1 kg | no | 1 | listo para indexar |
| AB-145 | Tomate · arroba 11,5 kg | no | 0 (1 dudosa) | dudoso |
| AB-146 | Zanahoria · arroba 11,5 kg | no | 1 | listo para indexar |
| AB-147 | Pimentón · 5 kg | no | 1 | listo para indexar |
| AB-148 | Locoto · 1 kg | no | 1 | listo para indexar |
| AB-149 | Yuca · arroba 11,5 kg | no | 0 (1 dudosa) | dudoso |
| AB-150 | Plátano verde · bolsa de 20 | no | 0 (1 dudosa) | dudoso |
| AB-151 | Plátano maduro · bolsa de 20 | no | 0 (1 dudosa) | dudoso |
| AB-152 | Lechuga · bolsa de 12 | no | 1 | listo para indexar |
| AB-153 | Charque de res · 1 kg | no | 0 (1 dudosa) | dudoso |
| AB-154 | Carne de res para guiso · 1 kg | no | 0 (1 dudosa) | dudoso |
| AB-155 | Carne molida de res · 1 kg | no | 1 | listo para indexar |
| AB-156 | Lomo de res · 1 kg | no | 0 (1 dudosa) | dudoso |
| AB-157 | Corazón de res · 1 kg | no | 0 (1 dudosa) | dudoso |
| AB-158 | Pollo entero | no | 1 | listo para indexar |
| AB-159 | Patas de pollo · 1 kg | no | 0 (1 dudosa) | dudoso |
| AB-160 | Gallina criolla | no | 0 (1 dudosa) | dudoso |
| AB-161 | Chorizo · 1 kg | no | 3 | listo para indexar |
| AB-162 | Salchicha Viena · 1 kg | no | 3 | listo para indexar |
| AB-163 | Pan de hamburguesa · bolsa de 50 | no | 1 | listo para indexar |
| AB-164 | Palitos de anticucho · paquete de 100 | no | 0 (1 dudosa) | dudoso |
| AB-165 | Bolsas de papel para pan · paquete de 500 | no | 0 (1 dudosa) | dudoso |
| AB-166 | Harina de maíz 1 kg | no | 0 (1 dudosa) | dudoso |
| AB-167 | Canela molida 250 g | no | 1 | listo para indexar |
| AB-168 | Cacao en polvo 500 g | no | 0 (1 dudosa) | dudoso |
| AB-169 | Coco rallado 500 g | no | 1 | listo para indexar |
| AB-170 | Azúcar impalpable 1 kg | no | 0 (1 dudosa) | dudoso |
| AB-171 | Leche condensada 395 g | no | 2 | listo para indexar |
| AB-172 | Leche en polvo 400 g | no | 1 | listo para indexar |
| AB-173 | Crema de leche 1 L | no | 1 | listo para indexar |
| AB-174 | Dulce de leche · balde 5 kg | no | 1 | listo para indexar |
| AB-175 | Mantequilla sin sal · 1 kg | no | 1 | listo para indexar |
| AB-176 | Queso menonita · 1 kg | no | 0 (1 dudosa) | dudoso |
| AB-177 | Frejol rojo 1 kg | no | 0 (1 dudosa) | dudoso |
| AB-178 | Lenteja 1 kg | no | 1 | listo para indexar |
| AB-179 | Mote de maíz pelado 1 kg | no | 0 | necesita foto propia |
| AB-180 | Quinua real 1 kg | no | 1 | listo para indexar |
| AB-181 | Avena en hojuelas 1 kg | no | 1 | listo para indexar |
| AB-182 | Fideo macarrón · bolsa 5 kg | no | 0 (1 dudosa) | dudoso |
| AB-183 | Laurel seco 100 g | no | 1 | listo para indexar |
| AB-184 | Salsa de soya · botella 1 L | no | 3 | listo para indexar |
| AB-185 | Caldo de gallina en cubitos · caja de 100 | no | 1 | listo para indexar |
| AB-186 | Sal gruesa parrillera 1 kg | no | 1 | listo para indexar |
| AB-187 | Mermelada de frutilla 500 g | no | 3 | listo para indexar |
| AB-188 | Café molido 500 g | no | 3 | listo para indexar |
| AB-189 | Té en bolsitas · caja de 100 | no | 1 | listo para indexar |
| AB-190 | Atún en lata 170 g | no | 0 (1 dudosa) | dudoso |
| AB-191 | Sardina en lata 425 g | no | 1 | listo para indexar |
| AB-192 | Limón · bolsa 5 kg | no | 0 (1 dudosa) | dudoso |
| AB-193 | Choclo · bolsa de 12 | no | 1 | listo para indexar |
| AB-194 | Repollo | no | 1 | listo para indexar |
| AB-195 | Pechuga de pollo · 1 kg | no | 0 (1 dudosa) | dudoso |
| AB-196 | Alitas de pollo · 1 kg | no | 0 | necesita foto propia |
| AB-197 | Costilla de res · 1 kg | no | 0 (1 dudosa) | dudoso |
| AB-198 | Costilla de cerdo · 1 kg | no | 1 | listo para indexar |
| AB-199 | Papas prefritas congeladas · bolsa 2,5 kg | no | 1 | listo para indexar |
| AB-200 | Carbón vegetal · bolsa 5 kg | no | 1 | listo para indexar |
| AB-201 | Guantes descartables · caja de 100 | no | 1 | listo para indexar |
| AB-202 | Papel para hornear · paquete de 100 | no | 0 (1 dudosa) | dudoso |
| AB-203 | Cajas para torta · paquete de 25 | no | 0 | necesita foto propia |
| AB-204 | Cajas para pollo · paquete de 100 | no | 0 | necesita foto propia |
| AB-205 | Cucharas descartables · paquete de 100 | no | 1 | listo para indexar |
| AB-206 | Papel aluminio · rollo de 30 m | no | 1 | listo para indexar |
| AB-207 | Jabón en barra para ropa · paquete de 6 | no | 0 (1 dudosa) | dudoso |
| AB-208 | Lavavajilla líquido 1 L | no | 1 | listo para indexar |
| AB-209 | Esponja de cocina · paquete de 6 | no | 1 | listo para indexar |
| AB-210 | Fósforos · paquete de 10 | no | 1 | listo para indexar |
| AB-211 | Velas · paquete de 6 | no | 1 | listo para indexar |

Las fotos dudosas no se descargan: el enlace queda en `ml/fotos-referencia.csv`. Las revisadas a mano que son el
mismo producto en otra presentación o marca (`PARECIDAS_ACEPTADAS`) se descargan como «parecida».
Las ilustraciones 3D del catálogo no cuentan como foto: son genéricas y no le enseñan fotos reales al modelo.
Los productos dudosos sin foto de catálogo siguen necesitando foto propia o del proveedor para indexarse.
Las fotos de referencia son sólo para el modelo local; no se publican en la app.

<!-- estado-fotos:fin -->

## Historial

| Fecha | Qué | Datos | Resultado |
|---|---|---|---|
| 31/10/2026 | Vectores y clasificador de 27 productos | Fotos del catálogo + simuladas | top-1 162/162 (simuladas) |
| 02/11/2026 | Fotos de referencia de los 49 productos de Abasto (todavía sin indexar) | Fidalga, Amarket y Guabirá | 31 listos para indexar, 16 dudosos, 2 necesitan foto propia (§5) |
| 02/11/2026 | Vectores de 5 platos bolivianos | 78 fotos de Wikimedia Commons (15 aparte para prueba) | top-1 12/15 = 80 % |
| 02/11/2026 | Vectores y clasificador de 117 de los 138 productos (`catalogo-imagenet-v2`) | 27 fotos de tienda + 128 de referencia (76 exactas, 52 parecidas revisadas a mano) + 43 de Commons revisadas | top-1 702/702 (simuladas); falta medir con fotos de celular reales |
