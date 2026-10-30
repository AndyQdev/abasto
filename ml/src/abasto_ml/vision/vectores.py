"""Vectores del catálogo: un vector por producto para buscar por parecido en el teléfono.

Solo numpy, sin TensorFlow: lo usa `entrenar.py` y se prueba en la CI sin instalar el grupo `vision`.
El formato es el que valida `leerVectores` en `apps/app/src/ia/parecido.ts`.
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from pathlib import Path

import numpy as np


def normalizar(vectores: np.ndarray) -> np.ndarray:
    """Deja cada fila con norma 1; una fila en cero se queda en cero (no NaN)."""
    normas = np.linalg.norm(vectores, axis=-1, keepdims=True)
    return np.divide(vectores, normas, out=np.zeros_like(vectores, dtype=np.float32), where=normas > 0)


def promedio_por_producto(vectores: np.ndarray, codigos: list[str]) -> dict[str, np.ndarray]:
    """El vector de un producto es el promedio de los vectores normalizados de sus fotos, normalizado otra vez."""
    if len(vectores) != len(codigos):
        raise ValueError(f"Hay {len(vectores)} vectores y {len(codigos)} códigos")
    unitarios = normalizar(np.asarray(vectores, dtype=np.float32))
    por_codigo: dict[str, np.ndarray] = {}
    for codigo in sorted(set(codigos)):
        filas = unitarios[[i for i, c in enumerate(codigos) if c == codigo]]
        por_codigo[codigo] = normalizar(filas.mean(axis=0))
    return por_codigo


def escribir(destino: Path, modelo: str, por_codigo: Mapping[str, np.ndarray], decimales: int = 5) -> None:
    dimensiones = {len(v) for v in por_codigo.values()}
    if len(dimensiones) != 1:
        raise ValueError(f"Los vectores tienen largos distintos: {sorted(dimensiones)}")
    datos = {
        "modelo": modelo,
        "dimension": dimensiones.pop(),
        # 5 decimales bastan para el coseno y dejan el JSON en ~3 KB por producto
        "productos": [
            {"codigo": c, "vector": [round(float(x), decimales) for x in v]}
            for c, v in sorted(por_codigo.items())
        ],
    }
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
