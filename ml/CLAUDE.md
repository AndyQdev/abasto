# ML · Python 3.12 con uv · dueño: Jhoel

Procesos programados, no un servicio: leen la base `reportes` y escriben ahí mismo sus predicciones.

- `demanda.py` (supervisado, GradientBoosting), `mora.py` (supervisado, regresión logística) y `segmentos.py` (no supervisado, K-means con nombres únicos).
- `nocturno.py` corre todo (`uv run abasto-ml-nocturno`). `datos.py` genera datos sintéticos para entrenar sin datos reales.
- `vision/`: MobileNetV3 entrenado con fotos de los productos (`datos/fotos/<CODIGO>/`, revisar con `vision/fotos.py`) → `productos.tflite` (float16), `etiquetas.json` y `vectores.json` en `apps/app/assets/modelos/`. Lo usa `reconocerProducto` en `apps/app/src/ia`. `--sin-entrenar` deja el modelo vacío. TensorFlow pesa ~600 MB: solo con `uv sync --group vision` o en Colab; sin él, la prueba de paridad Keras = TFLite se salta.

Probar: `pnpm test:ml`, o dentro de `ml/`: `uv run pytest` y `uv run ruff check`.
