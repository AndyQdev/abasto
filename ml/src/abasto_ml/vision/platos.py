"""Reconocer platos de comida con el mismo MobileNetV3 de los productos: un vector por plato.

Cada plato se describe con el promedio de los vectores de sus fotos de entrenamiento (`datos/platos/entrenar/<plato>/`).
En el teléfono, la misma pasada por la red que reconoce productos compara la foto con estos vectores (similitud coseno).
Sumar un plato es sumar fotos y volver a correr esto: no hace falta reentrenar la red.

La precisión se mide con las fotos de `datos/platos/prueba/`, que nunca se usan para armar los vectores.
Fotos: `uv run python -m abasto_ml.vision.platos_wikimedia`. Requiere `uv sync --group vision`.
Uso: uv run python -m abasto_ml.vision.platos
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from abasto_ml.vision import vectores
from abasto_ml.vision.catalogo import EXTENSIONES, vistas
from abasto_ml.vision.entrenar import SALIDA_POR_DEFECTO, construir

NOMBRE_DEL_MODELO = "platos-imagenet-v1"


def fotos_por_plato(carpeta: Path) -> dict[str, list[Path]]:
    if not carpeta.is_dir():
        return {}
    return {
        d.name: sorted(f for f in d.iterdir() if f.suffix.lower() in EXTENSIONES)
        for d in sorted(carpeta.iterdir())
        if d.is_dir()
    }


def generar(datos: Path, salida: Path) -> dict:
    from PIL import Image

    entrenar = {p: fs for p, fs in fotos_por_plato(datos / "entrenar").items() if fs}
    if not entrenar:
        raise SystemExit(f"No hay fotos en {datos / 'entrenar'}")
    # El vector no depende de la capa de clasificación: es la salida de MobileNetV3 (ImageNet), igual que en la app
    modelo, _ = construir(categorias=1)

    def vector_de(foto: Path) -> np.ndarray:
        lote = np.stack(vistas(Image.open(foto)))
        return vectores.normalizar(modelo(lote, training=False)["vector"].numpy().mean(axis=0))

    por_plato = {
        p: vectores.normalizar(np.mean([vector_de(f) for f in fs], axis=0)) for p, fs in entrenar.items()
    }
    vectores.escribir(salida / "platos.json", NOMBRE_DEL_MODELO, por_plato)

    # Precisión con fotos que no se usaron para armar los vectores
    nombres = list(por_plato)
    matriz = np.stack([por_plato[p] for p in nombres])
    aciertos = total = 0
    confusion: dict[str, dict[str, int]] = {}
    for plato, fotos in fotos_por_plato(datos / "prueba").items():
        if plato not in por_plato:
            continue
        for f in fotos:
            elegido = nombres[int(np.argmax(matriz @ vector_de(f)))]
            confusion.setdefault(plato, {}).setdefault(elegido, 0)
            confusion[plato][elegido] += 1
            aciertos += elegido == plato
            total += 1
    metricas = {
        "modelo": NOMBRE_DEL_MODELO,
        "platos": {p: len(fs) for p, fs in entrenar.items()},
        "fotos_de_prueba": total,
        "top1": round(aciertos / total, 3) if total else None,
        "confusion": confusion,
    }
    (salida / "metricas-platos.json").write_text(
        json.dumps(metricas, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return metricas


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--datos", type=Path, default=Path("datos/platos"))
    p.add_argument("--salida", type=Path, default=SALIDA_POR_DEFECTO)
    a = p.parse_args()
    print(json.dumps(generar(a.datos, a.salida), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
