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

## Historial

| Fecha | Qué | Datos | Resultado |
|---|---|---|---|
| 31/10/2026 | Vectores y clasificador de 27 productos | Fotos del catálogo + simuladas | top-1 162/162 (simuladas) |
| 02/11/2026 | Vectores de 5 platos bolivianos | 78 fotos de Wikimedia Commons (15 aparte para prueba) | top-1 12/15 = 80 % |
