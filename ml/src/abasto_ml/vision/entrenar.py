"""Deep learning con TensorFlow: reconoce la categoría de un producto en una foto de celular.

Transfer learning sobre MobileNetV3Small (preentrenada en ImageNet). Un solo entrenamiento, dos salidas:
  - modelos/entrenados/productos.tflite → Abasto Campo (en el teléfono, sin señal)
  - modelos/entrenados/tfjs/            → Abasto Mercado (buscar por foto en el navegador)

Datos: ml/datos/fotos/<categoria>/*.jpg (unas 10 categorías, 40 a 60 fotos cada una, tomadas en Los Pozos y La Ramada).
Requiere `uv sync --group vision`, o correrlo en Google Colab con GPU.
Uso: uv run python -m abasto_ml.vision.entrenar --fotos datos/fotos --epocas 10
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

TAMANO = (224, 224)


def entrenar(fotos: Path, salida: Path, epocas: int, semilla: int = 7) -> dict[str, float]:
    import tensorflow as tf

    tf.keras.utils.set_random_seed(semilla)
    entrenamiento, validacion = tf.keras.utils.image_dataset_from_directory(
        fotos, validation_split=0.2, subset="both", seed=semilla, image_size=TAMANO, batch_size=32
    )
    categorias = entrenamiento.class_names

    aumentos = tf.keras.Sequential(
        [
            tf.keras.layers.RandomFlip("horizontal"),
            tf.keras.layers.RandomRotation(0.08),
            tf.keras.layers.RandomZoom(0.1),
        ]
    )
    base = tf.keras.applications.MobileNetV3Small(
        input_shape=(*TAMANO, 3), include_top=False, weights="imagenet"
    )
    base.trainable = False

    entradas = tf.keras.Input(shape=(*TAMANO, 3))
    x = aumentos(entradas)
    x = base(x, training=False)
    vector = tf.keras.layers.GlobalAveragePooling2D(name="vector")(
        x
    )  # el vector también sirve para buscar parecidos
    x = tf.keras.layers.Dropout(0.2)(vector)
    salidas = tf.keras.layers.Dense(len(categorias), activation="softmax")(x)
    modelo = tf.keras.Model(entradas, salidas)

    modelo.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    historial = modelo.fit(entrenamiento, validation_data=validacion, epochs=epocas)

    salida.mkdir(parents=True, exist_ok=True)
    modelo.save(salida / "productos.keras")
    convertidor = tf.lite.TFLiteConverter.from_keras_model(modelo)
    convertidor.optimizations = [
        tf.lite.Optimize.DEFAULT
    ]  # cuantizado: ~4 veces más liviano para el teléfono
    (salida / "productos.tflite").write_bytes(convertidor.convert())

    import tensorflowjs as tfjs

    tfjs.converters.save_keras_model(modelo, str(salida / "tfjs"))

    metricas = {"precision_validacion": float(historial.history["val_accuracy"][-1])}
    (salida / "etiquetas.json").write_text(
        json.dumps(categorias, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (salida / "metricas.json").write_text(json.dumps(metricas, indent=2), encoding="utf-8")
    return metricas


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--fotos", type=Path, default=Path("datos/fotos"))
    p.add_argument("--salida", type=Path, default=Path("modelos/entrenados"))
    p.add_argument("--epocas", type=int, default=10)
    a = p.parse_args()
    print(entrenar(a.fotos, a.salida, a.epocas))


if __name__ == "__main__":
    main()
