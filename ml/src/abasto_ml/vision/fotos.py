"""Revisa las fotos del dataset de visión antes de entrenar.

El dataset vive en datos/fotos/<CODIGO>/*.jpg, una carpeta por código de producto.
Uso:
    uv run python -m abasto_ml.vision.fotos --crear   # crea las carpetas de la demo
    uv run python -m abasto_ml.vision.fotos           # cuenta las fotos y avisa cuáles faltan
"""

from __future__ import annotations

import argparse
from collections.abc import Iterable
from pathlib import Path

EXTENSIONES = {".jpg", ".jpeg", ".png", ".webp"}

PRODUCTOS_DE_LA_DEMO: dict[str, str] = {
    "AR-0100": "Arroz grano largo 1 kg",
    "AZ-1000": "Azúcar refinada 1 kg",
    "AC-0500": "Aceite comestible 500 ml",
    "FA-0900": "Fideo tallarín 900 g",
    "SA-1000": "Sal yodada 1 kg",
    "CA-0250": "Café molido 250 g",
    "RF-2000": "Refresco cola 2 L",
    "AG-0600": "Agua mineral 600 ml",
    "DE-1000": "Detergente en polvo 1 kg",
    "HB-0090": "Pasta dental 90 g",
}

MINIMO_POR_PRODUCTO = 15


def contar(fotos: Path) -> dict[str, int]:
    """Cuenta las fotos válidas de cada subcarpeta directa, ordenado por código."""
    if not fotos.is_dir():
        return {}

    conteo: dict[str, int] = {}
    for carpeta in sorted(fotos.iterdir()):
        if not carpeta.is_dir():
            continue
        conteo[carpeta.name] = sum(
            1 for archivo in carpeta.iterdir() if archivo.is_file() and archivo.suffix.lower() in EXTENSIONES
        )
    return conteo


def faltantes(conteo: dict[str, int], minimo: int = MINIMO_POR_PRODUCTO) -> list[str]:
    """Códigos con menos de `minimo` fotos, ordenados."""
    return sorted(codigo for codigo, total in conteo.items() if total < minimo)


def crear_carpetas(fotos: Path, codigos: Iterable[str]) -> list[Path]:
    """Crea fotos/<codigo>/ y devuelve las rutas, creadas o ya existentes."""
    rutas: list[Path] = []
    for codigo in codigos:
        ruta = fotos / codigo
        ruta.mkdir(parents=True, exist_ok=True)
        rutas.append(ruta)
    return rutas


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--fotos", type=Path, default=Path("datos/fotos"))
    parser.add_argument("--minimo", type=int, default=MINIMO_POR_PRODUCTO)
    parser.add_argument("--crear", action="store_true", help="crea las carpetas de la demo y termina")
    args = parser.parse_args()

    if args.crear:
        for ruta in crear_carpetas(args.fotos, PRODUCTOS_DE_LA_DEMO):
            print(ruta)
        return

    conteo = contar(args.fotos)
    completo = {codigo: conteo.get(codigo, 0) for codigo in sorted(set(conteo) | set(PRODUCTOS_DE_LA_DEMO))}

    print(f"{'CODIGO':<8}  {'NOMBRE':<26}  FOTOS")
    for codigo, total in completo.items():
        print(f"{codigo:<8}  {PRODUCTOS_DE_LA_DEMO.get(codigo, '?'):<26}  {total}")

    faltan = faltantes(completo, args.minimo)
    if faltan:
        print(f"Faltan fotos en: {', '.join(faltan)}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
