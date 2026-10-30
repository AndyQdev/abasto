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

# Productos reales del catálogo de Abasto (SembrarAbasto.php) que se consiguen en cualquier tienda
PRODUCTOS_DE_LA_DEMO: dict[str, str] = {
    "AB-001": "Arroz Caisy Grano de Oro 1 kg",
    "AB-002": "Azúcar Guabirá 1 kg",
    "AB-003": "Fideo spaghetti Don Vittorio 500 g",
    "AB-005": "Aceite Fino 900 ml",
    "AB-007": "Sal fina Lobos 1 kg",
    "AB-014": "Coca-Cola 2 L",
    "AB-015": "Agua Vital sin gas 2 L",
    "AB-017": "Leche PIL fresca 900 ml",
    "AB-025": "Detergente Skip 700 g",
    "AB-031": "Pasta dental Colgate Triple Acción 180 g",
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
