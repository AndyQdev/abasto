"""Fotos de platos bolivianos desde Wikimedia Commons, con autor y licencia de cada una.

Solo se bajan imágenes con licencia libre (CC0, CC BY, CC BY-SA, dominio público) y se anota la atribución en
`atribuciones.csv`. Un 20 % de cada plato queda aparte para medir (nunca se usa al calcular los vectores).
Las fotos no van al repo (`ml/datos/` está en .gitignore).

Uso: uv run python -m abasto_ml.vision.platos_wikimedia --maximo 40
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

PLATOS: dict[str, list[str]] = {
    "salchipapa": ["Salchipapas", "Salchipapa"],
    "pique-macho": ["Pique macho"],
    "silpancho": ["Silpancho"],
    "majadito": ["Majadito"],
    "saltena": ["Salteñas (Bolivia)"],
}
LICENCIAS_PERMITIDAS = ("cc0", "cc by", "cc-by", "public domain", "pd")
API = "https://commons.wikimedia.org/w/api.php"
# Wikimedia frena (429) a quien no se identifica con un User-Agent que tenga un contacto
AGENTE = "AbastoEstudiantes/1.0 (https://github.com/AndyQdev/abasto; proyecto universitario) python-urllib"


def _pedir_json(params: dict[str, str], intentos: int = 5) -> dict:
    url = f"{API}?{urllib.parse.urlencode({**params, 'format': 'json'})}"
    for intento in range(intentos):
        try:
            with urllib.request.urlopen(
                urllib.request.Request(url, headers={"User-Agent": AGENTE}), timeout=30
            ) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429 or intento == intentos - 1:
                raise
            time.sleep(5 * (intento + 1))
    return {}


def _bajar(url: str, destino: Path, intentos: int = 5) -> None:
    for intento in range(intentos):
        try:
            with urllib.request.urlopen(
                urllib.request.Request(url, headers={"User-Agent": AGENTE}), timeout=60
            ) as r:
                destino.write_bytes(r.read())
            return
        except urllib.error.HTTPError as e:
            # 429: Wikimedia pide ir más despacio; se espera cada vez más
            if e.code != 429 or intento == intentos - 1:
                raise
            time.sleep(5 * (intento + 1))


def archivos_de_categoria(categoria: str, maximo: int = 100) -> list[str]:
    datos = _pedir_json(
        {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": f"Category:{categoria}",
            "cmtype": "file",
            "cmlimit": str(maximo),
        }
    )
    titulos = [m["title"] for m in datos.get("query", {}).get("categorymembers", [])]
    return [t for t in titulos if t.lower().endswith((".jpg", ".jpeg", ".png"))]


def info_de_archivo(titulo: str) -> dict | None:
    datos = _pedir_json(
        {
            "action": "query",
            "titles": titulo,
            "prop": "imageinfo",
            "iiprop": "url|extmetadata",
            "iiurlwidth": "512",
        }
    )
    for pagina in datos.get("query", {}).get("pages", {}).values():
        info = (pagina.get("imageinfo") or [None])[0]
        if not info or "thumburl" not in info:
            return None
        meta = info.get("extmetadata", {})
        autor = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()
        return {
            "url": info["thumburl"],
            "licencia": meta.get("LicenseShortName", {}).get("value", ""),
            "autor": autor,
            "pagina": info.get("descriptionurl", ""),
        }
    return None


def licencia_permitida(licencia: str) -> bool:
    return licencia.strip().lower().startswith(LICENCIAS_PERMITIDAS)


def bajar_plato(
    plato: str, categorias: list[str], destino: Path, maximo: int = 40, prueba: float = 0.2
) -> dict[str, int]:
    titulos = list(dict.fromkeys(t for c in categorias for t in archivos_de_categoria(c)))
    cuenta = {"entrenar": 0, "prueba": 0, "descartadas_por_licencia": 0}
    atribuciones = destino / "atribuciones.csv"
    ya = (
        {fila["archivo"] for fila in csv.DictReader(atribuciones.open(encoding="utf-8"))}
        if atribuciones.exists()
        else set()
    )
    for titulo in titulos:
        if cuenta["entrenar"] + cuenta["prueba"] >= maximo:
            break
        info = info_de_archivo(titulo)
        if not info or not licencia_permitida(info["licencia"]):
            cuenta["descartadas_por_licencia"] += 1
            continue
        huella = hashlib.sha1(titulo.encode()).hexdigest()
        # El hash del título decide el conjunto: repetible entre corridas
        conjunto = "prueba" if int(huella, 16) % 100 < prueba * 100 else "entrenar"
        archivo = destino / conjunto / plato / f"{huella[:12]}{Path(titulo).suffix.lower()}"
        archivo.parent.mkdir(parents=True, exist_ok=True)
        if not archivo.exists():
            _bajar(info["url"], archivo)
            time.sleep(2)
        nombre = f"{conjunto}/{plato}/{archivo.name}"
        if nombre not in ya:
            nuevo = not atribuciones.exists()
            with atribuciones.open("a", newline="", encoding="utf-8") as f:
                w = csv.writer(f)
                if nuevo:
                    w.writerow(["plato", "archivo", "conjunto", "autor", "licencia", "pagina"])
                w.writerow([plato, nombre, conjunto, info["autor"], info["licencia"], info["pagina"]])
            ya.add(nombre)
        cuenta[conjunto] += 1
    return cuenta


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--destino", type=Path, default=Path("datos/platos"))
    p.add_argument("--maximo", type=int, default=40)
    p.add_argument("--platos", nargs="*", default=list(PLATOS))
    a = p.parse_args()
    a.destino.mkdir(parents=True, exist_ok=True)
    print(f"{'PLATO':<12} ENTRENAR PRUEBA DESCARTADAS")
    for plato in a.platos:
        c = bajar_plato(plato, PLATOS[plato], a.destino, a.maximo)
        print(f"{plato:<12} {c['entrenar']:>8} {c['prueba']:>6} {c['descartadas_por_licencia']:>11}")
    print(f"Atribuciones: {a.destino / 'atribuciones.csv'}")


if __name__ == "__main__":
    main()
