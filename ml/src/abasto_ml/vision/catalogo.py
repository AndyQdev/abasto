"""Buscar por foto desde el primer día: vectores sacados de la foto de cada producto del catálogo.

MobileNetV3 preentrenado en ImageNet ya distingue envases, colores y logotipos. Con la foto oficial de cada
producto (`services/catalogo/database/fotos-abasto/<CODIGO>.webp`) se arma un vector por producto, sin fotos
propias ni entrenamiento. Cuando haya fotos sacadas en tienda, `entrenar.py` afina el modelo con ellas.

Cada producto se describe con varias vistas de su foto (recortes más cerrados y con menos luz), porque en la
tienda el producto nunca sale tan centrado ni tan iluminado como en la foto del catálogo.

Después se entrena con TensorFlow la capa que clasifica (transfer learning) con fotos de celular simuladas.

La evaluación simula fotos de celular (recorte corrido, giro, otra luz y desenfoque) y mide si el producto
correcto queda primero (top-1) o entre los 3 primeros (top-3).

Requiere `uv sync --group vision`. Uso: uv run python -m abasto_ml.vision.catalogo
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import numpy as np

from abasto_ml.vision import vectores
from abasto_ml.vision.entrenar import ML, SALIDA_POR_DEFECTO, TAMANO, a_tflite, construir

FOTOS_DEL_CATALOGO = ML.parent / "services" / "catalogo" / "database" / "fotos-abasto"
FOTOS_DE_REFERENCIA = ML / "datos" / "fotos-referencia"
ATRIBUCIONES_COMMONS = ML / "atribuciones-productos.csv"
# Fotos de tiendas y sitios web para los productos sin foto de referencia, revisadas a mano (03/11). Las imágenes no
# van al repo (licencia desconocida, solo para entrenar en local): el índice con la fuente de cada una sí.
FOTOS_WEB = ML / "fotos-web.csv"
NOMBRE_DEL_MODELO = "catalogo-imagenet-v2"
EXTENSIONES = {".webp", ".jpg", ".jpeg", ".png"}
RECORTES = (1.0, 0.85, 0.7)


def fotos_web(indice: Path, raiz: Path = ML.parent) -> dict[str, list[Path]]:
    """Código → fotos web revisadas (`ml/fotos-web.csv`) que están en disco. Las que no se bajaron se saltan."""
    if not indice.is_file():
        return {}
    fotos: dict[str, list[Path]] = {}
    with indice.open(encoding="utf-8") as archivo:
        for fila in csv.DictReader(archivo):
            ruta = raiz / fila["archivo"]
            if ruta.is_file():
                fotos.setdefault(fila["codigo"], []).append(ruta)
    return fotos


def leer_fotos(
    carpeta: Path,
    referencia: Path | None = FOTOS_DE_REFERENCIA,
    commons: Path | None = ATRIBUCIONES_COMMONS,
    web: Path | None = FOTOS_WEB,
) -> dict[str, list[Path]]:
    """Código de producto → sus fotos reales.

    Del catálogo solo cuentan las fotos de tienda (`FOTOS_DE_TIENDA`): las ilustraciones 3D genéricas no le enseñan
    fotos reales al modelo. Se suman las fotos de referencia de tiendas bolivianas (`fotos_referencia.py`), las de
    Wikimedia Commons aprobadas y las de la web revisadas a mano (`ml/fotos-web.csv`).
    """
    from abasto_ml.vision.fotos_referencia import FOTOS_DE_TIENDA

    fotos: dict[str, list[Path]] = {}
    for f in sorted(carpeta.iterdir()):
        if (
            f.is_file()
            and f.suffix.lower() in EXTENSIONES
            and (carpeta != FOTOS_DEL_CATALOGO or f.stem in FOTOS_DE_TIENDA)
        ):
            fotos.setdefault(f.stem, []).append(f)
    if referencia is not None and referencia.is_dir():
        for sub in sorted(d for d in referencia.iterdir() if d.is_dir()):
            fotos.setdefault(sub.name, []).extend(
                f for f in sorted(sub.iterdir()) if f.is_file() and f.suffix.lower() in EXTENSIONES
            )
    if commons is not None:
        from abasto_ml.vision.productos_wikimedia import aprobadas

        for codigo, fs in aprobadas(commons).items():
            fotos.setdefault(codigo, []).extend(fs)
    if web is not None:
        for codigo, fs in fotos_web(web).items():
            fotos.setdefault(codigo, []).extend(fs)
    return {c: fs for c, fs in sorted(fotos.items()) if fs}


def a_entrada(imagen) -> np.ndarray:
    """PIL → 224×224 RGB float32 de 0 a 255, recortando el cuadrado del medio (igual que `recorteCentrado` en la app)."""
    imagen = imagen.convert("RGB")
    lado = min(imagen.size)
    x, y = (imagen.width - lado) // 2, (imagen.height - lado) // 2
    return np.asarray(imagen.crop((x, y, x + lado, y + lado)).resize(TAMANO), dtype=np.float32)


def vistas(imagen) -> list[np.ndarray]:
    """Recortes centrados al 100, 85 y 70 %, y cada uno también con un 15 % menos de luz."""
    resultado = []
    for proporcion in RECORTES:
        lado = int(min(imagen.size) * proporcion)
        x, y = (imagen.width - lado) // 2, (imagen.height - lado) // 2
        vista = a_entrada(imagen.crop((x, y, x + lado, y + lado)))
        resultado += [vista, vista * 0.85]
    return resultado


def como_foto_de_celular(imagen, rng: np.random.Generator) -> np.ndarray:
    """Una foto «sacada en la tienda»: recorte corrido del 70 al 95 %, giro de ±12°, otra luz y algo de desenfoque."""
    from PIL import ImageEnhance, ImageFilter

    imagen = imagen.convert("RGB").rotate(rng.uniform(-12, 12), fillcolor=(235, 235, 230))
    lado = int(min(imagen.size) * rng.uniform(0.7, 0.95))
    x = int(rng.uniform(0, imagen.width - lado))
    y = int(rng.uniform(0, imagen.height - lado))
    imagen = imagen.crop((x, y, x + lado, y + lado))
    imagen = ImageEnhance.Brightness(imagen).enhance(rng.uniform(0.65, 1.2))
    imagen = imagen.filter(ImageFilter.GaussianBlur(rng.uniform(0, 1.5)))
    return a_entrada(imagen)


def entrenar_clasificador(vectores_de, imagenes, codigos, rng, por_producto: int = 40, epocas: int = 60):
    """Deep learning con TensorFlow: entrena la capa que decide qué producto es.

    Los ejemplos son fotos de celular simuladas desde la foto del catálogo. La base de MobileNetV3 queda congelada:
    se entrena sobre su vector (transfer learning), así el vector que usa la búsqueda por parecido no cambia.
    """
    import tensorflow as tf

    x, y = [], []
    for i, codigo in enumerate(codigos):
        fotos = imagenes[codigo]
        x.append(vectores_de([como_foto_de_celular(fotos[k % len(fotos)], rng) for k in range(por_producto)]))
        y += [i] * por_producto
    x, y = np.concatenate(x), np.array(y)
    orden = rng.permutation(
        len(y)
    )  # validation_split toma el final: sin mezclar, validaría solo los últimos productos
    x, y = x[orden], y[orden]

    cabeza = tf.keras.Sequential(
        [
            tf.keras.Input(shape=(x.shape[1],)),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.Dense(len(codigos), activation="softmax"),
        ]
    )
    cabeza.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3), loss="sparse_categorical_crossentropy", metrics=["accuracy"]
    )
    historial = cabeza.fit(x, y, validation_split=0.2, epochs=epocas, batch_size=32, verbose=0)
    return cabeza.layers[-1].get_weights(), float(historial.history["val_accuracy"][-1])


def generar(fotos: Path, salida: Path, pruebas_por_producto: int = 6, semilla: int = 7) -> dict:
    from PIL import Image

    archivos = leer_fotos(fotos)
    if not archivos:
        raise SystemExit(f"No hay fotos en {fotos}")
    codigos = list(archivos)
    modelo, _ = construir(categorias=len(codigos), semilla=semilla)

    def salidas_de(lote: list[np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
        partes = [modelo(np.stack(lote[i : i + 64]), training=False) for i in range(0, len(lote), 64)]
        return (
            np.concatenate([p["vector"].numpy() for p in partes]),
            np.concatenate([p["probabilidades"].numpy() for p in partes]),
        )

    def vectores_de(lote: list[np.ndarray]) -> np.ndarray:
        return salidas_de(lote)[0]

    imagenes = {c: [Image.open(f).convert("RGB") for f in fs] for c, fs in archivos.items()}
    por_codigo = {
        c: vectores.normalizar(vectores_de([v for im in ims for v in vistas(im)]).mean(axis=0))
        for c, ims in imagenes.items()
    }

    rng = np.random.default_rng(semilla)
    pesos, precision_validacion = entrenar_clasificador(vectores_de, imagenes, codigos, rng)
    modelo.get_layer("probabilidades").set_weights(pesos)

    salida.mkdir(parents=True, exist_ok=True)
    (salida / "productos.tflite").write_bytes(a_tflite(modelo))
    vectores.escribir(salida / "vectores.json", NOMBRE_DEL_MODELO, por_codigo)
    (salida / "etiquetas.json").write_text(
        json.dumps(codigos, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # Fotos de prueba nuevas (otra semilla): el modelo nunca las vio al entrenar
    rng = np.random.default_rng(semilla + 1000)
    matriz = np.stack([por_codigo[c] for c in codigos])
    aciertos = {"vector": 0, "clasificador": 0, "juntos": 0}
    aciertos_3 = total = 0
    for i, codigo in enumerate(codigos):
        vecs, probs = salidas_de(
            [
                como_foto_de_celular(imagenes[codigo][k % len(imagenes[codigo])], rng)
                for k in range(pruebas_por_producto)
            ]
        )
        parecidos = np.clip(vectores.normalizar(vecs) @ matriz.T, 0, 1)
        juntos = mezclar(parecidos, probs)
        aciertos["vector"] += int((parecidos.argmax(axis=1) == i).sum())
        aciertos["clasificador"] += int((probs.argmax(axis=1) == i).sum())
        aciertos["juntos"] += int((juntos.argmax(axis=1) == i).sum())
        aciertos_3 += int((np.argsort(-juntos, axis=1)[:, :3] == i).any(axis=1).sum())
        total += pruebas_por_producto

    metricas = {
        "modelo": NOMBRE_DEL_MODELO,
        "productos": len(codigos),
        "fotos_reales": sum(len(fs) for fs in archivos.values()),
        "precision_validacion_clasificador": round(precision_validacion, 3),
        "fotos_de_prueba": total,
        "top1_vector": round(aciertos["vector"] / total, 3),
        "top1_clasificador": round(aciertos["clasificador"] / total, 3),
        "top1": round(aciertos["juntos"] / total, 3),
        "top3": round(aciertos_3 / total, 3),
    }
    (salida / "metricas.json").write_text(
        json.dumps(metricas, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return metricas


def mezclar(parecidos: np.ndarray, probabilidades: np.ndarray, peso_vector: float = 0.5) -> np.ndarray:
    """La misma mezcla que hace la app en `mezclarConClasificador` (apps/app/src/ia/parecido.ts)."""
    return peso_vector * parecidos + (1 - peso_vector) * probabilidades


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--fotos", type=Path, default=FOTOS_DEL_CATALOGO)
    p.add_argument("--salida", type=Path, default=SALIDA_POR_DEFECTO)
    p.add_argument("--pruebas", type=int, default=6, help="fotos simuladas por producto para medir")
    a = p.parse_args()
    print(generar(a.fotos, a.salida, a.pruebas))


if __name__ == "__main__":
    main()
