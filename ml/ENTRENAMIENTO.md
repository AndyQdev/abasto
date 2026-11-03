# Qué está entrenado en Abasto y de dónde salieron los datos

Dueño: Jhoel. Actualizado: 02/11/2026. Antes de entrenar algo nuevo, lee esto y súmale una fila a «Historial».

## 1. Modelos que van hoy en la app (teléfono)

Todos usan **una sola red**: MobileNetV3Small preentrenada en ImageNet (TensorFlow/Keras) exportada a
TFLite float16 (`apps/app/assets/modelos/productos.tflite`, ~1,9 MB). Una pasada por la foto da un **vector de 576
números** (embedding); ese vector se compara por similitud coseno con los vectores guardados (búsqueda vectorial local,
sin internet).

| Qué reconoce | Archivo en la app | Cómo se generó | Datos | Resultado |
|---|---|---|---|---|
| **27 productos** del catálogo de Abasto | `vectores.json`, `etiquetas.json` | `ml/src/abasto_ml/vision/catalogo.py` | 1 foto oficial por producto (`services/catalogo/database/fotos-abasto/`) + 6 vistas por foto (recortes y menos luz) | top-1 162/162 con fotos de celular **simuladas** (optimista: salen de la misma foto) |
| Clasificador de los 27 productos (deep learning, TensorFlow) | dentro de `productos.tflite` | `catalogo.py` › `entrenar_clasificador` (transfer learning: base congelada, capa densa entrenada) | 40 fotos de celular simuladas por producto (giro, recorte, luz, desenfoque) | validación 100 % (mismo aviso) |
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
| Amarket | 11922 productos con imagen |
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
| AB-104 | Levadura seca instantánea 500 g | no | 0 (1 dudosa) | dudoso |
| AB-105 | Polvo de hornear 1 kg | no | 0 (1 dudosa) | dudoso |
| AB-106 | Manteca vegetal · balde 15 kg | no | 0 (1 dudosa) | dudoso |
| AB-107 | Aceite vegetal · bidón 5 L | no | 0 (1 dudosa) | dudoso |
| AB-108 | Arroz · quintal 46 kg | no | 0 (1 dudosa) | dudoso |
| AB-109 | Arroz · arroba 11,5 kg | no | 0 (1 dudosa) | dudoso |
| AB-110 | Fideo tallarín · bolsa 5 kg | no | 0 (1 dudosa) | dudoso |
| AB-111 | Ají colorado molido 1 kg | no | 0 (1 dudosa) | dudoso |
| AB-112 | Comino molido 500 g | no | 0 (1 dudosa) | dudoso |
| AB-113 | Pimienta negra molida 500 g | no | 0 (1 dudosa) | dudoso |
| AB-114 | Orégano seco 500 g | no | 0 (1 dudosa) | dudoso |
| AB-115 | Huevo · maple de 30 | no | 3 | listo para indexar |
| AB-116 | Papa · arroba 11,5 kg | no | 0 (1 dudosa) | dudoso |
| AB-117 | Cebolla · arroba 11,5 kg | no | 0 (1 dudosa) | dudoso |
| AB-118 | Ajo · 1 kg | no | 0 (1 dudosa) | dudoso |
| AB-119 | Bolsas plásticas medianas · paquete de 100 | no | 0 | necesita foto propia |
| AB-120 | Envase de plastoformo con tapa · paquete de 100 | no | 0 | necesita foto propia |
| AB-121 | Servilletas · paquete de 500 | no | 3 | listo para indexar |
| AB-122 | Vasos descartables 250 ml · paquete de 100 | no | 1 | listo para indexar |

Las fotos dudosas no se descargan: el enlace queda en `ml/fotos-referencia.csv`.
Los productos dudosos sin foto de catálogo siguen necesitando foto propia o del proveedor para indexarse.
Las fotos de referencia son sólo para el modelo local; no se publican en la app.
<!-- estado-fotos:fin -->

## Historial

| Fecha | Qué | Datos | Resultado |
|---|---|---|---|
| 31/10/2026 | Vectores y clasificador de 27 productos | Fotos del catálogo + simuladas | top-1 162/162 (simuladas) |
| 02/11/2026 | Fotos de referencia de los 49 productos de Abasto (todavía sin indexar) | Fidalga, Amarket y Guabirá | 31 listos para indexar, 16 dudosos, 2 necesitan foto propia (§5) |
| 02/11/2026 | Vectores de 5 platos bolivianos | 78 fotos de Wikimedia Commons (15 aparte para prueba) | top-1 12/15 = 80 % |
