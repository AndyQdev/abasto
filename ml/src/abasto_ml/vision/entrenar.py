"""Deep learning con TensorFlow: reconoce un producto del catálogo en una foto de celular.

Transfer learning sobre MobileNetV3Small (preentrenada en ImageNet), entrenada con fotos de nuestros productos.
El modelo tiene dos salidas:
  - `probabilidades`: el código de producto más probable (clasificación).
  - `vector`: 576 números que describen la foto. En el teléfono se compara con `vectores.json`
    (similitud coseno), así un producto nuevo se reconoce con una foto, sin volver a entrenar.

Entrada: imagen 224×224 RGB en float32 de 0 a 255 (MobileNetV3 trae su propio preprocesado adentro).
Datos: ml/datos/fotos/<CODIGO>/*.jpg (revisar con `uv run python -m abasto_ml.vision.fotos`).
Salida en apps/app/assets/modelos/: productos.tflite, etiquetas.json, vectores.json y metricas.json.

Requiere `uv sync --group vision`, o Google Colab con GPU.
Uso: uv run python -m abasto_ml.vision.entrenar --fotos datos/fotos --epocas 12 --afinar 6
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from abasto_ml.vision import vectores

TAMANO = (224, 224)
NOMBRE_DEL_MODELO = "productos-v1"
ML = Path(__file__).resolve().parents[3]
SALIDA_POR_DEFECTO = ML.parent / "apps" / "app" / "assets" / "modelos"
KERAS = ML / "modelos" / "entrenados" / "productos.keras"


def construir(categorias: int, semilla: int = 7):
    import tensorflow as tf

    tf.keras.utils.set_random_seed(semilla)
    base = tf.keras.applications.MobileNetV3Small(
        input_shape=(*TAMANO, 3), include_top=False, weights="imagenet", include_preprocessing=True
    )
    base.trainable = False

    entradas = tf.keras.Input(shape=(*TAMANO, 3), name="imagen")
    # Fotos de celular en una tienda: de costado, con otra luz y más lejos o más cerca
    aumentos = tf.keras.Sequential(
        [
            tf.keras.layers.RandomFlip("horizontal"),
            tf.keras.layers.RandomRotation(0.08),
            tf.keras.layers.RandomZoom(0.15),
            tf.keras.layers.RandomBrightness(0.2, value_range=(0, 255)),
            tf.keras.layers.RandomContrast(0.2),
        ],
        name="aumentos",
    )
    x = base(aumentos(entradas), training=False)
    vector = tf.keras.layers.GlobalAveragePooling2D(name="vector")(x)
    x = tf.keras.layers.Dropout(0.2)(vector)
    probabilidades = tf.keras.layers.Dense(categorias, activation="softmax", name="probabilidades")(x)
    return tf.keras.Model(entradas, {"probabilidades": probabilidades, "vector": vector}), base


def entrenar(fotos: Path, salida: Path, epocas: int, afinar: int = 0, semilla: int = 7) -> dict[str, float]:
    import tensorflow as tf

    entrenamiento, validacion = tf.keras.utils.image_dataset_from_directory(
        fotos, validation_split=0.2, subset="both", seed=semilla, image_size=TAMANO, batch_size=16
    )
    codigos = entrenamiento.class_names
    modelo, base = construir(len(codigos), semilla)

    solo_clase = {"probabilidades": "sparse_categorical_crossentropy", "vector": None}
    modelo.compile(optimizer="adam", loss=solo_clase, metrics={"probabilidades": "accuracy"})
    historial = modelo.fit(entrenamiento, validation_data=validacion, epochs=epocas)

    if afinar:
        # Se descongelan solo los últimos bloques, con una tasa chica, para no borrar lo que trae de ImageNet
        base.trainable = True
        for capa in base.layers[:-30]:
            capa.trainable = False
        modelo.compile(
            optimizer=tf.keras.optimizers.Adam(1e-5), loss=solo_clase, metrics={"probabilidades": "accuracy"}
        )
        historial = modelo.fit(entrenamiento, validation_data=validacion, epochs=afinar)

    salida.mkdir(parents=True, exist_ok=True)
    KERAS.parent.mkdir(parents=True, exist_ok=True)
    modelo.save(KERAS)  # no va al repo: la prueba de paridad lo compara con el .tflite
    (salida / "productos.tflite").write_bytes(a_tflite(modelo))

    # Los vectores del catálogo salen de todas las fotos, sin aumentos
    todas = tf.keras.utils.image_dataset_from_directory(
        fotos, image_size=TAMANO, batch_size=16, shuffle=False
    )
    vecs = np.concatenate([modelo(lote, training=False)["vector"].numpy() for lote, _ in todas])
    codigo_de_cada_foto = [codigos[i] for _, etiquetas in todas for i in etiquetas.numpy()]
    vectores.escribir(
        salida / "vectores.json", NOMBRE_DEL_MODELO, vectores.promedio_por_producto(vecs, codigo_de_cada_foto)
    )

    metricas = {
        "modelo": NOMBRE_DEL_MODELO,
        "productos": len(codigos),
        "fotos": len(codigo_de_cada_foto),
        "precision_validacion": round(float(historial.history["val_probabilidades_accuracy"][-1]), 4),
    }
    (salida / "etiquetas.json").write_text(
        json.dumps(codigos, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (salida / "metricas.json").write_text(
        json.dumps(metricas, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return metricas


def exportar_sin_entrenar(salida: Path) -> None:
    """Deja un modelo con la forma final y un catálogo sin vectores: la app compila y `reconocerProducto` devuelve []."""
    modelo, _ = construir(categorias=1)
    salida.mkdir(parents=True, exist_ok=True)
    (salida / "productos.tflite").write_bytes(a_tflite(modelo))
    datos = {"modelo": "sin-entrenar", "dimension": int(modelo.outputs[1].shape[-1]), "productos": []}
    (salida / "vectores.json").write_text(json.dumps(datos), encoding="utf-8")


def a_tflite(modelo) -> bytes:
    import tensorflow as tf

    convertidor = tf.lite.TFLiteConverter.from_keras_model(modelo)
    # Pesos en float16: la mitad de liviano (~5 MB) y el vector casi igual al de Keras.
    # El cuantizado a int8 pesaba la cuarta parte, pero movía el vector (coseno 0,97 contra Keras)
    convertidor.optimizations = [tf.lite.Optimize.DEFAULT]
    convertidor.target_spec.supported_types = [tf.float16]
    return convertidor.convert()


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--fotos", type=Path, default=Path("datos/fotos"))
    p.add_argument("--salida", type=Path, default=SALIDA_POR_DEFECTO)
    p.add_argument("--epocas", type=int, default=12)
    p.add_argument("--afinar", type=int, default=6, help="épocas extra con los últimos bloques descongelados")
    p.add_argument(
        "--sin-entrenar", action="store_true", help="solo exporta el modelo vacío para que la app compile"
    )
    a = p.parse_args()
    if a.sin_entrenar:
        exportar_sin_entrenar(a.salida)
    else:
        print(entrenar(a.fotos, a.salida, a.epocas, a.afinar))


if __name__ == "__main__":
    main()
