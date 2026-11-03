"""Fotos reales de los productos genéricos del catálogo (carne, verduras, descartables) desde Wikimedia Commons.

Para los productos que las tiendas en línea no tienen (`fotos_referencia.py` no encontró una foto exacta ni parecida).
Solo licencias libres (CC0, CC BY, CC BY-SA, dominio público), con la atribución en `ml/atribuciones-productos.csv`.
Las fotos van a `ml/datos/fotos-commons/<CODIGO>/` (ignorado por git) y `catalogo.py` las suma al indexar.
Cada foto se revisa a mano: la columna `estado` del CSV dice `aprobada`, `descartada` (se borra del disco pero queda
anotada para no volver a bajarla) o `sin revisar`. `catalogo.py` usa solo las aprobadas.

Uso: uv run python -m abasto_ml.vision.productos_wikimedia --maximo 4
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import time
from pathlib import Path

from abasto_ml.vision.platos_wikimedia import _bajar, _pedir_json, info_de_archivo, licencia_permitida

ML = Path(__file__).resolve().parents[3]
DESTINO = ML / "datos" / "fotos-commons"
ATRIBUCIONES = ML / "atribuciones-productos.csv"

# Código → búsqueda en Commons (en inglés hay muchas más fotos). Los que son el mismo producto que otro ya indexado
# en otra presentación (harina por quintal y por arroba, arroz, sal, aceite) no se buscan: en una foto no se distinguen.
BUSQUEDAS: dict[str, str] = {
    "AB-116": "potatoes sack market",
    "AB-119": "plastic shopping bags",
    "AB-120": "styrofoam food container clamshell",
    "AB-126": "corn starch box",
    "AB-136": "annatto achiote powder",
    "AB-138": "white vinegar bottle",
    "AB-140": "raisins",
    "AB-142": "ketchup bottle",
    "AB-145": "tomatoes market",
    "AB-149": "cassava roots yuca",
    "AB-150": "green plantains",
    "AB-151": "ripe plantains",
    "AB-153": "charqui dried meat",
    "AB-154": "beef stew meat raw cubes",
    "AB-156": "beef tenderloin raw",
    "AB-157": "beef heart raw",
    "AB-159": "chicken feet raw",
    "AB-160": "whole raw hen chicken",
    "AB-164": "bamboo skewers",
    "AB-165": "paper bread bags",
    "AB-166": "corn flour bag",
    "AB-168": "cocoa powder",
    "AB-170": "powdered sugar",
    "AB-176": "Mennonite cheese",
    "AB-177": "red kidney beans",
    "AB-179": "mote hominy corn",
    "AB-182": "macaroni pasta",
    "AB-190": "canned tuna",
    "AB-192": "limes fruit",
    "AB-195": "raw chicken breast",
    "AB-196": "raw chicken wings",
    "AB-197": "raw beef ribs",
    "AB-202": "baking parchment paper",
    "AB-203": "cake box cardboard",
    "AB-204": "chicken takeaway box",
    "AB-207": "laundry soap bar",
}

def buscar(consulta: str, maximo: int = 20) -> list[str]:
    datos = _pedir_json(
        {
            "action": "query",
            "list": "search",
            "srsearch": f"{consulta} filetype:bitmap",
            "srnamespace": "6",
            "srlimit": str(maximo),
        }
    )
    titulos = [r["title"] for r in datos.get("query", {}).get("search", [])]
    return [t for t in titulos if t.lower().endswith((".jpg", ".jpeg", ".png"))]


def leer_atribuciones(ruta: Path = ATRIBUCIONES) -> list[dict[str, str]]:
    if not ruta.exists():
        return []
    with ruta.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def escribir_atribuciones(filas: list[dict[str, str]], ruta: Path = ATRIBUCIONES) -> None:
    with ruta.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["codigo", "archivo", "estado", "titulo", "autor", "licencia", "pagina"])
        w.writeheader()
        w.writerows(sorted(filas, key=lambda x: (x["codigo"], x["archivo"])))


def bajar_producto(codigo: str, consulta: str, maximo: int, filas: list[dict[str, str]]) -> int:
    ya = {f["titulo"] for f in filas if f["codigo"] == codigo}
    bajadas = sum(1 for f in filas if f["codigo"] == codigo and f["estado"] != "descartada")
    for titulo in buscar(consulta):
        if bajadas >= maximo:
            break
        if titulo in ya:
            continue
        info = info_de_archivo(titulo)
        if not info or not licencia_permitida(info["licencia"]):
            continue
        huella = hashlib.sha1(titulo.encode()).hexdigest()[:12]
        archivo = DESTINO / codigo / f"{huella}{Path(titulo).suffix.lower()}"
        archivo.parent.mkdir(parents=True, exist_ok=True)
        if not archivo.exists():
            _bajar(info["url"], archivo)
            time.sleep(2)
        filas.append(
            {
                "codigo": codigo,
                "archivo": str(archivo.relative_to(ML.parent)).replace("\\", "/"),
                "estado": "sin revisar",
                "titulo": titulo,
                "autor": info["autor"],
                "licencia": info["licencia"],
                "pagina": info["pagina"],
            }
        )
        bajadas += 1
    return bajadas


def quitar_descartadas(filas: list[dict[str, str]]) -> list[dict[str, str]]:
    """Borra del disco las fotos revisadas que no muestran el producto (la fila queda para no volver a bajarlas)."""
    for fila in filas:
        if fila["estado"] == "descartada":
            (ML.parent / fila["archivo"]).unlink(missing_ok=True)
    return filas


def aprobadas(ruta: Path = ATRIBUCIONES, raiz: Path = ML.parent) -> dict[str, list[Path]]:
    """Código → fotos de Commons revisadas y aprobadas (las que usa `catalogo.py`)."""
    fotos: dict[str, list[Path]] = {}
    for fila in leer_atribuciones(ruta):
        if fila["estado"] == "aprobada" and (raiz / fila["archivo"]).is_file():
            fotos.setdefault(fila["codigo"], []).append(raiz / fila["archivo"])
    return fotos


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--maximo", type=int, default=4, help="fotos por producto")
    a = p.parse_args()
    filas = quitar_descartadas(leer_atribuciones())
    for codigo, consulta in BUSQUEDAS.items():
        n = bajar_producto(codigo, consulta, a.maximo, filas)
        print(f"{codigo} «{consulta}»: {n}")
        escribir_atribuciones(filas)
    print(f"total: {len(filas)} fotos de {len({f['codigo'] for f in filas})} productos")


if __name__ == "__main__":
    main()
