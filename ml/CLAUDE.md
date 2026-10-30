# ML · Python 3.12 con uv · dueño: Jhoel

Procesos programados, no un servicio: leen la base `reportes` y escriben ahí mismo sus predicciones.

- `demanda.py` (supervisado, GradientBoosting), `mora.py` (supervisado, regresión logística) y `segmentos.py` (no supervisado, K-means con nombres únicos).
- `nocturno.py` corre todo (`uv run abasto-ml-nocturno`). `datos.py` genera datos sintéticos para entrenar sin datos reales.
- `vision/entrenar.py`: MobileNetV3 → TFLite para la app de clientes (`apps/app/src/ia`, buscar por foto). TensorFlow pesa ~600 MB: solo con `uv sync --group vision` o en Colab.

Probar: `pnpm test:ml`, o dentro de `ml/`: `uv run pytest` y `uv run ruff check`.
