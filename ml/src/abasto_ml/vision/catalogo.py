"""Buscar por foto desde el primer día: vectores sacados de la foto de cada producto del catálogo.

MobileNetV3 preentrenado en ImageNet ya distingue envases, colores y logotipos. Con la foto oficial de cada
producto (`services/catalogo/database/fotos-abasto/<CODIGO>.webp`) se arma un vector por producto, sin fotos
propias ni entrenamiento. Cuando haya fotos sacadas en tienda, `entrenar.py` afina el modelo con ellas.

Cada producto se describe con varias vistas de su foto (recortes más cerrados y con menos luz), porque en la
tienda el producto nunca sale tan centrado ni tan iluminado como en la foto del catálogo.

La evaluación simula fotos de celular (recorte corrido, giro, otra luz y desenfoque) y mide si el producto
correcto queda primero (top-1) o entre los 3 primeros (top-3).

Requiere `uv sync --group vision`. Uso: uv run python -m abasto_ml.vision.catalogo
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from abasto_ml.vision import vectores
from abasto_ml.vision.entrenar import ML, SALIDA_POR_DEFECTO, TAMANO, a_tflite, construir

FOTOS_DEL_CATALOGO = ML.parent / "services" / "catalogo" / "database" / "fotos-abasto"
NOMBRE_DEL_MODELO = "catalogo-imagenet-v1"
EXTENSIONES = {".webp", ".jpg", ".jpeg", ".png"}
RECORTES = (1.0, 0.85, 0.7)


def leer_fotos(carpeta: Path) -> dict[str, Path]:
    """Código de producto → foto. El código es el nombre del archivo."""
    return {f.stem: f for f in sorted(carpeta.iterdir()) if f.is_file() and f.suffix.lower() in EXTENSIONES}


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


def generar(fotos: Path, salida: Path, pruebas_por_producto: int = 6, semilla: int = 7) -> dict:
    from PIL import Image

    archivos = leer_fotos(fotos)
    if not archivos:
        raise SystemExit(f"No hay fotos en {fotos}")
    codigos = list(archivos)
    modelo, _ = construir(categorias=len(codigos), semilla=semilla)

    def vectores_de(lote: list[np.ndarray]) -> np.ndarray:
        return modelo(np.stack(lote), training=False)["vector"].numpy()

    imagenes = {c: Image.open(f) for c, f in archivos.items()}
    por_codigo = {c: vectores.normalizar(vectores_de(vistas(im)).mean(axis=0)) for c, im in imagenes.items()}

    salida.mkdir(parents=True, exist_ok=True)
    (salida / "productos.tflite").write_bytes(a_tflite(modelo))
    vectores.escribir(salida / "vectores.json", NOMBRE_DEL_MODELO, por_codigo)
    (salida / "etiquetas.json").write_text(
        json.dumps(codigos, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    rng = np.random.default_rng(semilla)
    matriz = np.stack([por_codigo[c] for c in codigos])
    aciertos_1 = aciertos_3 = total = 0
    for i, codigo in enumerate(codigos):
        fotos_de_prueba = [como_foto_de_celular(imagenes[codigo], rng) for _ in range(pruebas_por_producto)]
        parecidos = vectores.normalizar(vectores_de(fotos_de_prueba)) @ matriz.T
        orden = np.argsort(-parecidos, axis=1)
        aciertos_1 += int((orden[:, 0] == i).sum())
        aciertos_3 += int((orden[:, :3] == i).any(axis=1).sum())
        total += pruebas_por_producto

    metricas = {
        "modelo": NOMBRE_DEL_MODELO,
        "productos": len(codigos),
        "fotos_de_prueba": total,
        "top1": round(aciertos_1 / total, 3),
        "top3": round(aciertos_3 / total, 3),
    }
    (salida / "metricas.json").write_text(
        json.dumps(metricas, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return metricas


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--fotos", type=Path, default=FOTOS_DEL_CATALOGO)
    p.add_argument("--salida", type=Path, default=SALIDA_POR_DEFECTO)
    p.add_argument("--pruebas", type=int, default=6, help="fotos simuladas por producto para medir")
    a = p.parse_args()
    print(generar(a.fotos, a.salida, a.pruebas))


if __name__ == "__main__":
    main()
