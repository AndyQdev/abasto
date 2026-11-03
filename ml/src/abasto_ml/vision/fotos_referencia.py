"""Busca fotos de referencia exactas de los productos de Abasto en tiendas bolivianas.

El catálogo de Abasto tiene 49 productos: 27 ya traen foto y 22 no. Este script
recorre las tiendas que publican un sitemap de productos (Fidalga, Amarket,
Sofía), la API de PIL y las presentaciones de Guabirá, y empareja marca +
producto + peso/presentación. Sólo descarga una foto cuando la coincidencia es
exacta; cuando hay duda deja el enlace anotado como ``dudosa``.

Reglas:
- 1 pedido por segundo por sitio y User-Agent identificable.
- Se respeta ``robots.txt``.
- Nada de fotos genéricas ni de otro peso.
- Los archivos van a ``ml/datos/fotos-referencia/<CODIGO>/<sha1-12>.<ext>``
  (ignorado por git) y el índice a ``ml/fotos-referencia.csv``.

Uso::

    uv run python -m abasto_ml.vision.fotos_referencia --resumen
    uv run python -m abasto_ml.vision.fotos_referencia
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

ML = Path(__file__).resolve().parents[3]
CATALOGO = ML.parent / "services" / "catalogo" / "app" / "Console" / "Commands" / "SembrarAbasto.php"
FOTOS_CATALOGO = ML.parent / "services" / "catalogo" / "database" / "fotos-abasto"
DESTINO = ML / "datos" / "fotos-referencia"
CSV_SALIDA = ML / "fotos-referencia.csv"
# El estado va como una sección de ENTRENAMIENTO.md (entre marcas), no en un archivo aparte
ESTADO = ML / "ENTRENAMIENTO.md"
INICIO, FIN = "<!-- estado-fotos:inicio -->", "<!-- estado-fotos:fin -->"

AGENTE = "AbastoEstudiantes/1.0 (https://github.com/AndyQdev/abasto)"
MAX_FOTOS = 3
ESPERA = 1.1
MAX_BYTES = 8 * 1024 * 1024

NS = {
    "s": "http://www.sitemaps.org/schemas/sitemap/0.9",
    "image": "http://www.google.com/schemas/sitemap-image/1.1",
}

UNIDADES = {
    "kilogramos": ("g", 1000),
    "kilogramo": ("g", 1000),
    "kilos": ("g", 1000),
    "kilo": ("g", 1000),
    "kgs": ("g", 1000),
    "kg": ("g", 1000),
    "kl": ("g", 1000),
    "k": ("g", 1000),
    "gramos": ("g", 1),
    "gramo": ("g", 1),
    "grs": ("g", 1),
    "gr": ("g", 1),
    "gs": ("g", 1),
    "g": ("g", 1),
    "mililitros": ("ml", 1),
    "mililitro": ("ml", 1),
    "ml": ("ml", 1),
    "cc": ("ml", 1),
    "litros": ("ml", 1000),
    "litro": ("ml", 1000),
    "lts": ("ml", 1000),
    "lt": ("ml", 1000),
    "l": ("ml", 1000),
    "unidades": ("u", 1),
    "unidad": ("u", 1),
    "unid": ("u", 1),
    "uni": ("u", 1),
    "und": ("u", 1),
    "un": ("u", 1),
    "u": ("u", 1),
    "rollos": ("u", 1),
    "rollo": ("u", 1),
    "sobres": ("u", 1),
    "sobre": ("u", 1),
    "sachets": ("u", 1),
    "sachet": ("u", 1),
}

IGNORAR = {
    "de",
    "del",
    "la",
    "el",
    "los",
    "las",
    "y",
    "x",
    "al",
    "por",
    "con",
    *UNIDADES,
    "quintal",
    "arroba",
    "maple",
    "paquete",
    "docena",
    "bolsa",
    "balde",
    "bidon",
    "caja",
    "frasco",
    "pote",
    "botella",
    "doypack",
}

SINONIMOS = {
    "victorio": "vittorio",
    "victtorio": "vittorio",
    "desechable": "descartable",
}

VARIANTES = {
    "sin",
    "light",
    "zero",
    "deslactosada",
    "deslactosado",
    "descremada",
    "descremado",
    "diet",
    "integral",
    "retornable",
    "gel",
    "recarga",
    "morena",
    "rubia",
}

PATRON_CANTIDAD = re.compile(
    r"(?<![a-z0-9/-])(\d+(?:[.,]\d+)?)\s*"
    r"(kilogramos|kilogramo|kilos|kilo|kgs|kg|kl|k|"
    r"gramos|gramo|grs|gr|gs|g|"
    r"mililitros|mililitro|ml|cc|"
    r"litros|litro|lts|lt|l|"
    r"unidades|unidad|unid|uni|und|un|u|"
    r"rollos|rollo|sobres|sobre|sachets|sachet)(?![a-z])",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class Producto:
    codigo: str
    nombre: str


@dataclass(frozen=True)
class Fuente:
    nombre: str
    host: str
    tipo: str
    nota: str = ""


@dataclass(frozen=True)
class Entrada:
    fuente: str
    titulo: str
    url_producto: str
    url_imagen: str


@dataclass(frozen=True)
class Preparada:
    entrada: Entrada
    cantidades: frozenset[tuple[str, float]]
    tokens: tuple[str, ...]


@dataclass
class Plan:
    producto: Producto
    exactas: list[Preparada]
    dudosa: Preparada | None


@dataclass
class Fila:
    codigo: str
    nombre_catalogo: str
    archivo: str
    fuente: str
    url_producto: str
    url_imagen: str
    coincidencia: str
    fecha: str


FUENTES = (
    Fuente("Fidalga", "www.fidalga.com", "shopify"),
    Fuente("Amarket", "amarket.com.bo", "shopify"),
    Fuente("Hipermaxi", "www.hipermaxi.com", "shopify", "la home redirige a validate.perfdrive.com (Radware)"),
    Fuente("PIL", "pilbolivia.com.bo", "pil", "sólo publica banners de categoría, no fotos de envase"),
    Fuente("Guabirá", "guabira.com", "guabira"),
    Fuente("Sofía", "sofia.com.bo", "shopify"),
)


def normalizar(texto: str) -> str:
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return texto.lower()


def cantidades(texto: str) -> frozenset[tuple[str, float]]:
    """Cantidades del texto en unidades base: gramos, mililitros o unidades."""
    limpio = normalizar(texto)
    valores: set[tuple[str, float]] = set()
    for numero, unidad in PATRON_CANTIDAD.findall(limpio):
        base, factor = UNIDADES[unidad]
        valor = float(numero.replace(",", ".")) * factor
        valores.add((base, round(valor, 3)))
    if "quintal" in limpio:
        valores.add(("g", 46000.0))
    if "arroba" in limpio:
        valores.add(("g", 11500.0))
    if "docena" in limpio:
        valores.add(("u", 12.0))
    paquete = re.search(r"paquete\s+(?:de|x)\s*(\d+)", limpio)
    if paquete:
        valores.add(("u", float(paquete.group(1))))
    maple = re.search(r"maple\s+de\s+(\d+)", limpio)
    if maple:
        valores.add(("u", float(maple.group(1))))
    elif "maple" in limpio:
        valores.add(("u", 30.0))
    varias = re.search(r"(?<![a-z0-9])(\d+)\s+de\s+(?=\d)", limpio)
    if varias:
        valores.add(("u", float(varias.group(1))))
    return frozenset(valores)


def tokens(texto: str) -> tuple[str, ...]:
    limpio = normalizar(texto).replace("'", "").replace("\u2019", "")
    salida: list[str] = []
    for palabra in re.findall(r"[a-z0-9]+", limpio):
        if palabra.isdigit() or palabra in IGNORAR:
            continue
        if len(palabra) > 3 and palabra.endswith("s") and not palabra.endswith(("ss", "us", "is")):
            palabra = palabra[:-1]
        palabra = SINONIMOS.get(palabra, palabra)
        if palabra not in salida:
            salida.append(palabra)
    return tuple(salida)


def _variante_extra(nombre: str, titulo: str) -> bool:
    extra = set(tokens(titulo)) - set(tokens(nombre))
    if extra & VARIANTES:
        return True
    ceros = re.search(r"(?<![0-9])0{3,4}(?![0-9])", titulo)
    return bool(ceros and not re.search(r"(?<![0-9])0{3,4}(?![0-9])", nombre))


def coincidencia(nombre: str, titulo: str) -> str | None:
    """Devuelve ``exacta``, ``dudosa`` o ``None`` para un título de tienda."""
    cant_catalogo = cantidades(nombre)
    cant_titulo = cantidades(titulo)
    tok_catalogo = set(tokens(nombre))
    tok_titulo = set(tokens(titulo))
    if not tok_catalogo or not cant_catalogo or not cant_titulo:
        return None
    if cant_catalogo != cant_titulo:
        return None
    if not tok_catalogo <= tok_titulo:
        return None
    return "dudosa" if _variante_extra(nombre, titulo) else "exacta"


def parecido(nombre: str, titulo: str) -> float:
    """Puntaje de 0 a 1,5 para elegir la presentación dudosa más cercana."""
    tok_catalogo = tokens(nombre)
    cant_catalogo = cantidades(nombre)
    if not tok_catalogo:
        return 0.0
    tok_titulo = set(tokens(titulo))
    if tok_catalogo[0] not in tok_titulo:
        return 0.0
    if tok_catalogo[0] in {"papa", "cebolla", "ajo"} and tok_titulo & {"frita", "frito", "pringle", "lays", "snack", "chip"}:
        return 0.0
    comunes = len(set(tok_catalogo) & tok_titulo)
    proporcion = comunes / len(tok_catalogo)
    if proporcion < 0.5:
        return 0.0
    misma_cantidad = 0.5 if cant_catalogo & cantidades(titulo) else 0.0
    sobrantes = len(tok_titulo - set(tok_catalogo))
    return max(proporcion + misma_cantidad - 0.01 * sobrantes, 0.0)


def leer_catalogo(ruta: Path = CATALOGO) -> list[Producto]:
    texto = ruta.read_text(encoding="utf-8")
    patron = re.compile(r"\['(AB-\d{3})',\s*'((?:[^'\\]|\\.)*)'")
    productos: list[Producto] = []
    for codigo, nombre in patron.findall(texto):
        productos.append(Producto(codigo, nombre.replace("\\'", "'")))
    return productos


def codigos_con_foto(carpeta: Path = FOTOS_CATALOGO) -> set[str]:
    if not carpeta.is_dir():
        return set()
    return {ruta.stem for ruta in carpeta.glob("AB-*") if ruta.is_file()}


class Ritmo:
    def __init__(self, espera: float = ESPERA) -> None:
        self.espera = espera
        self._ultimo: dict[str, float] = {}

    def esperar(self, host: str) -> None:
        ahora = time.monotonic()
        anterior = self._ultimo.get(host)
        if anterior is not None:
            falta = self.espera - (ahora - anterior)
            if falta > 0:
                time.sleep(falta)
        self._ultimo[host] = time.monotonic()


def _pedir_crudo(url: str, timeout: int = 40) -> bytes:
    pedido = urllib.request.Request(url, headers={"User-Agent": AGENTE, "Accept": "*/*"})
    with urllib.request.urlopen(pedido, timeout=timeout) as respuesta:
        return respuesta.read()


class Robots:
    def __init__(self, agente: str = AGENTE) -> None:
        self.agente = agente
        self._parsers: dict[str, urllib.robotparser.RobotFileParser] = {}

    def cargar(self, host: str, ritmo: Ritmo | None = None) -> None:
        parser = urllib.robotparser.RobotFileParser()
        if ritmo is not None:
            ritmo.esperar(host)
        try:
            datos = _pedir_crudo(f"https://{host}/robots.txt")
        except urllib.error.HTTPError as error:
            if error.code != 404:
                raise
            parser.parse([])
        else:
            parser.parse(datos.decode("utf-8", errors="replace").splitlines())
        self._parsers[host] = parser

    def permitido(self, url: str) -> bool:
        host = urllib.parse.urlparse(url).netloc
        parser = self._parsers.get(host)
        if parser is None:
            return True
        return parser.can_fetch(self.agente, url)


def pedir(url: str, ritmo: Ritmo, robots: Robots, intentos: int = 3) -> bytes:
    if not robots.permitido(url):
        raise PermissionError(f"robots.txt prohíbe {url}")
    host = urllib.parse.urlparse(url).netloc
    for intento in range(intentos):
        ritmo.esperar(host)
        try:
            return _pedir_crudo(url)
        except urllib.error.HTTPError as error:
            if error.code in (429, 500, 502, 503, 504) and intento < intentos - 1:
                time.sleep(2 * (intento + 1))
                continue
            raise
        except (urllib.error.URLError, TimeoutError):
            if intento < intentos - 1:
                time.sleep(2 * (intento + 1))
                continue
            raise
    raise RuntimeError(f"no se pudo pedir {url}")


def _texto(datos: bytes) -> str:
    return datos.decode("utf-8", errors="replace")


def _entradas_de_urlset(texto: str) -> list[Entrada]:
    raiz = ET.fromstring(texto)
    salida: list[Entrada] = []
    for nodo in raiz.findall("s:url", NS):
        producto = nodo.findtext("s:loc", default="", namespaces=NS).strip()
        for imagen in nodo.findall("image:image", NS):
            titulo = imagen.findtext("image:title", default="", namespaces=NS)
            url = imagen.findtext("image:loc", default="", namespaces=NS)
            if producto and titulo and url:
                salida.append(Entrada("", html.unescape(titulo), html.unescape(producto), html.unescape(url)))
    return salida


def _sitemaps_de_productos(texto: str) -> list[str]:
    raiz = ET.fromstring(texto)
    urls = [nodo.text.strip() for nodo in raiz.iter() if nodo.tag.endswith("loc") and nodo.text]
    return [url for url in urls if "products" in url]


def _entradas_shopify(fuente: Fuente, ritmo: Ritmo, robots: Robots) -> tuple[list[Entrada], str]:
    indice = f"https://{fuente.host}/sitemap.xml"
    texto = _texto(pedir(indice, ritmo, robots))
    if "<sitemapindex" not in texto:
        entradas = _entradas_de_urlset(texto)
        return [Entrada(fuente.nombre, e.titulo, e.url_producto, e.url_imagen) for e in entradas], ""
    sitemaps = _sitemaps_de_productos(texto)
    if not sitemaps:
        return [], "sin sitemap de productos (sólo portada)"
    salida: list[Entrada] = []
    for sitemap in sitemaps:
        for entrada in _entradas_de_urlset(_texto(pedir(sitemap, ritmo, robots))):
            salida.append(
                Entrada(fuente.nombre, entrada.titulo, entrada.url_producto, entrada.url_imagen)
            )
    return salida, f"{len(salida)} productos con imagen"


class _Enlaces(HTMLParser):
    def __init__(self, patron: str) -> None:
        super().__init__()
        self.patron = re.compile(patron)
        self.enlaces: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        href = dict(attrs).get("href") or ""
        if self.patron.search(href):
            self.enlaces.append(href)


class _Imagenes(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.fuentes: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "img":
            return
        src = dict(attrs).get("src") or ""
        if src:
            self.fuentes.append(src)


def presentacion_de_guabira(nombre: str) -> str:
    limpio = nombre.lower().split("?")[0]
    if "46kg" in limpio:
        return "46 kg"
    if "50kg" in limpio:
        return "50 kg"
    if "arroba" in limpio:
        return "arroba"
    rango = re.search(r"(\d+)-6g", limpio)
    if rango:
        return f"{rango.group(1)} sachet de 6 g"
    peso = re.search(r"(\d+(?:[.,]\d+)?)kg", limpio)
    if peso:
        return f"{peso.group(1)} kg"
    return ""


def _variante_guabira(enlace: str) -> str:
    ultimo = enlace.rstrip("/").rsplit("/", 1)[-1]
    ultimo = ultimo.replace("azucar-", "").replace("azucar_", "").replace("-", " ")
    return ultimo.title()


def _entradas_guabira(fuente: Fuente, ritmo: Ritmo, robots: Robots) -> tuple[list[Entrada], str]:
    base = f"https://{fuente.host}"
    parser = _Enlaces(r"/azucar/[a-z0-9-]+")
    parser.feed(_texto(pedir(f"{base}/productos", ritmo, robots)))
    salida: list[Entrada] = []
    for enlace in sorted(set(parser.enlaces)):
        url_producto = urllib.parse.urljoin(base, enlace)
        pagina = _Imagenes()
        pagina.feed(_texto(pedir(url_producto, ritmo, robots)))
        for src in pagina.fuentes:
            if "/public/img/presentations/" not in src:
                continue
            presentacion = presentacion_de_guabira(src)
            if not presentacion:
                continue
            titulo = f"Azucar {_variante_guabira(enlace)} {presentacion}"
            salida.append(Entrada(fuente.nombre, titulo, url_producto, urllib.parse.urljoin(base, src)))
    return salida, f"{len(salida)} presentaciones con imagen"


def _generica_pil(src: str) -> bool:
    prohibidas = (
        "generico",
        "banner",
        "bnner",
        "interna",
        "portada",
        "placeholder",
        "logo",
        "icon",
        "listo-crecer",
        "lucide",
        "weui",
        "streamline",
    )
    return any(palabra in src.lower() for palabra in prohibidas)


def _entradas_pil(fuente: Fuente, ritmo: Ritmo, robots: Robots) -> tuple[list[Entrada], str]:
    url = f"https://{fuente.host}/wp-json/wp/v2/producto?per_page=100"
    datos = json.loads(_texto(pedir(url, ritmo, robots)))
    salida: list[Entrada] = []
    for item in datos:
        titulo = html.unescape(re.sub(r"<[^>]+>", "", item["title"]["rendered"])).strip()
        for src in re.findall(r'<img[^>]+src="([^"]+)"', item["content"]["rendered"]):
            if src.startswith("data:") or _generica_pil(src):
                continue
            salida.append(
                Entrada(
                    fuente.nombre,
                    titulo,
                    urllib.parse.urljoin(f"https://{fuente.host}", url),
                    urllib.parse.urljoin(f"https://{fuente.host}", html.unescape(src)),
                )
            )
    return salida, f"{len(salida)} fotos de producto (sin banners)"


def recolectar(
    fuentes: tuple[Fuente, ...] = FUENTES,
    ritmo: Ritmo | None = None,
    robots: Robots | None = None,
) -> tuple[list[Entrada], list[tuple[str, str]], Ritmo, Robots]:
    ritmo = ritmo or Ritmo()
    robots = robots or Robots()
    entradas: list[Entrada] = []
    notas: list[tuple[str, str]] = []
    for fuente in fuentes:
        try:
            robots.cargar(fuente.host, ritmo)
        except Exception as error:  # noqa: BLE001 - se documenta y se sigue con las demás
            notas.append((fuente.nombre, f"robots.txt inaccesible: {error}"))
            continue
        try:
            if fuente.tipo == "shopify":
                nuevas, nota = _entradas_shopify(fuente, ritmo, robots)
            elif fuente.tipo == "pil":
                nuevas, nota = _entradas_pil(fuente, ritmo, robots)
            else:
                nuevas, nota = _entradas_guabira(fuente, ritmo, robots)
        except Exception as error:  # noqa: BLE001 - se documenta y se sigue con las demás
            detalle = f"no se pudo usar: {error}"
            if fuente.nota:
                detalle += f" ({fuente.nota})"
            notas.append((fuente.nombre, detalle))
            continue
        entradas.extend(nuevas)
        detalle = nota or "0 entradas"
        if fuente.nota:
            detalle += f"; {fuente.nota}"
        notas.append((fuente.nombre, detalle))
    return entradas, notas, ritmo, robots


def preparar(entradas: list[Entrada]) -> list[Preparada]:
    return [Preparada(entrada, cantidades(entrada.titulo), tokens(entrada.titulo)) for entrada in entradas]


def _foto_utilizable(url: str) -> bool:
    basura = ("whatsappimage", "placeholder", "no-image", "sin-imagen")
    return not any(palabra in url.lower() for palabra in basura)


def planificar(productos: list[Producto], preparadas: list[Preparada]) -> list[Plan]:
    planes: list[Plan] = []
    for producto in productos:
        cant = cantidades(producto.nombre)
        tok = set(tokens(producto.nombre))
        exactas: list[Preparada] = []
        dudosa: tuple[float, Preparada] | None = None
        vistos: set[str] = set()
        for preparada in preparadas:
            if not _foto_utilizable(preparada.entrada.url_imagen):
                continue
            titulo = preparada.entrada.titulo
            if preparada.cantidades != cant or not tok <= set(preparada.tokens):
                puntaje = parecido(producto.nombre, titulo)
                if puntaje > 0 and (dudosa is None or puntaje > dudosa[0]):
                    dudosa = (puntaje, preparada)
                continue
            if _variante_extra(producto.nombre, titulo):
                puntaje = parecido(producto.nombre, titulo)
                if dudosa is None or puntaje > dudosa[0]:
                    dudosa = (puntaje, preparada)
                continue
            clave = preparada.entrada.url_imagen
            if clave in vistos:
                continue
            vistos.add(clave)
            exactas.append(preparada)
        exactas.sort(key=lambda p: (FUENTES.index(next(f for f in FUENTES if f.nombre == p.entrada.fuente)), p.entrada.titulo))
        planes.append(Plan(producto, exactas[:MAX_FOTOS], dudosa[1] if dudosa else None))
    return planes


def extension(datos: bytes, url: str) -> str:
    if datos.startswith(b"\x89PNG"):
        return "png"
    if datos.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if datos.startswith(b"RIFF") and datos[8:12] == b"WEBP":
        return "webp"
    if datos.startswith(b"GIF8"):
        return "gif"
    sufijo = Path(urllib.parse.urlparse(url).path).suffix.lower().lstrip(".")
    return sufijo if sufijo in {"jpg", "jpeg", "png", "webp", "gif"} else "jpg"


def guardar_foto(datos: bytes, url: str, carpeta: Path, usados: dict[str, Path]) -> Path | None:
    sha1 = hashlib.sha1(datos).hexdigest()
    existente = usados.get(sha1)
    if existente is not None:
        return existente if existente.parent == carpeta else None
    carpeta.mkdir(parents=True, exist_ok=True)
    ruta = carpeta / f"{sha1[:12]}.{extension(datos, url)}"
    ruta.write_bytes(datos)
    usados[sha1] = ruta
    return ruta


def _usados_en_disco(carpeta: Path) -> dict[str, Path]:
    if not carpeta.is_dir():
        return {}
    return {
        hashlib.sha1(ruta.read_bytes()).hexdigest(): ruta for ruta in carpeta.rglob("*") if ruta.is_file()
    }


def descargar(
    planes: list[Plan], ritmo: Ritmo, robots: Robots, fecha: str
) -> tuple[list[Fila], list[tuple[Plan, Preparada]]]:
    usados = _usados_en_disco(DESTINO)
    filas: list[Fila] = []
    fallidas: list[tuple[Plan, Preparada]] = []
    for plan in planes:
        for preparada in plan.exactas:
            entrada = preparada.entrada
            try:
                datos = pedir(entrada.url_imagen, ritmo, robots)
            except Exception as error:  # noqa: BLE001 - se anota y se sigue
                print(f"  aviso: {plan.producto.codigo} {entrada.url_imagen}: {error}")
                fallidas.append((plan, preparada))
                continue
            if len(datos) > MAX_BYTES:
                print(f"  aviso: {plan.producto.codigo} imagen demasiado grande, se omite")
                fallidas.append((plan, preparada))
                continue
            ruta = guardar_foto(datos, entrada.url_imagen, DESTINO / plan.producto.codigo, usados)
            if ruta is None:
                continue
            filas.append(
                Fila(
                    plan.producto.codigo,
                    plan.producto.nombre,
                    str(ruta.relative_to(ML.parent)).replace("\\", "/"),
                    entrada.fuente,
                    entrada.url_producto,
                    entrada.url_imagen,
                    "exacta",
                    fecha,
                )
            )
    return filas, fallidas


def escribir_csv(filas: list[Fila]) -> None:
    campos = ["codigo", "nombre_catalogo", "archivo", "fuente", "url_producto", "url_imagen", "coincidencia", "fecha"]
    with CSV_SALIDA.open("w", encoding="utf-8", newline="") as archivo:
        escritor = csv.DictWriter(archivo, fieldnames=campos)
        escritor.writeheader()
        for fila in filas:
            escritor.writerow(fila.__dict__)


def limpiar_huerfanos(filas: list[Fila], destino: Path = DESTINO, raiz: Path = ML.parent) -> None:
    referenciados = {(raiz / fila.archivo).resolve() for fila in filas if fila.archivo}
    if not destino.is_dir():
        return
    for ruta in destino.rglob("*"):
        if ruta.is_file() and ruta.resolve() not in referenciados:
            ruta.unlink()
    for carpeta in sorted((ruta for ruta in destino.rglob("*") if ruta.is_dir()), reverse=True):
        if not any(carpeta.iterdir()):
            carpeta.rmdir()


def escribir_estado(
    planes: list[Plan], filas: list[Fila], notas: list[tuple[str, str]], fecha: str
) -> dict[str, int]:
    con_foto = codigos_con_foto()
    por_codigo: dict[str, list[Fila]] = {}
    for fila in filas:
        por_codigo.setdefault(fila.codigo, []).append(fila)
    cuenta = {"listo para indexar": 0, "dudoso": 0, "necesita foto propia": 0}
    lineas = [
        "## 5. Fotos de los productos del catálogo",
        "",
        f"Generado por `ml/src/abasto_ml/vision/fotos_referencia.py` el {fecha}.",
        "",
        "### Fuentes",
        "",
        "| Sitio | Resultado |",
        "| --- | --- |",
    ]
    for nombre, nota in notas:
        lineas.append(f"| {nombre} | {nota} |")
    lineas += [
        "",
        "### Productos",
        "",
        "| Código | Producto | Foto del catálogo | Fotos de referencia | Estado |",
        "| --- | --- | --- | --- | --- |",
    ]
    for plan in planes:
        codigo = plan.producto.codigo
        exactas = sum(1 for fila in por_codigo.get(codigo, []) if fila.coincidencia == "exacta")
        dudosa = plan.dudosa is not None and codigo not in con_foto
        if codigo in con_foto or exactas:
            estado = "listo para indexar"
        elif dudosa:
            estado = "dudoso"
        else:
            estado = "necesita foto propia"
        cuenta[estado] += 1
        referencia = str(exactas)
        if dudosa and exactas == 0:
            referencia = "0 (1 dudosa)"
        lineas.append(
            f"| {codigo} | {plan.producto.nombre} | {'sí' if codigo in con_foto else 'no'} | "
            f"{referencia} | {estado} |"
        )
    lineas += [
        "",
        "Las fotos dudosas no se descargan: el enlace queda en `ml/fotos-referencia.csv`.",
        "Los productos dudosos sin foto de catálogo siguen necesitando foto propia o del proveedor para indexarse.",
        "Las fotos de referencia son sólo para el modelo local; no se publican en la app.",
        "",
    ]
    bloque = "\n".join([INICIO, *lineas, FIN])
    texto = ESTADO.read_text(encoding="utf-8") if ESTADO.exists() else ""
    if INICIO in texto and FIN in texto:
        texto = texto[: texto.index(INICIO)] + bloque + texto[texto.index(FIN) + len(FIN) :]
    else:
        texto = texto.rstrip() + "\n\n" + bloque + "\n"
    ESTADO.write_text(texto, encoding="utf-8")
    return cuenta


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Busca fotos de referencia exactas para el catálogo de Abasto.")
    parser.add_argument("--resumen", action="store_true", help="no descarga ni escribe: sólo muestra el plan")
    args = parser.parse_args(argv)

    productos = leer_catalogo()
    if len(productos) != 49:
        print(f"aviso: el catálogo tiene {len(productos)} productos, se esperaban 49")
    entradas, notas, ritmo, robots = recolectar()
    for nombre, nota in notas:
        print(f"{nombre}: {nota}")
    print(f"entradas con imagen: {len(entradas)}")

    planes = planificar(productos, preparar(entradas))
    if args.resumen:
        for plan in planes:
            dudosa = f" · dudosa: {plan.dudosa.entrada.titulo}" if plan.dudosa else ""
            print(f"{plan.producto.codigo} {plan.producto.nombre}: {len(plan.exactas)} exactas{dudosa}")
        return 0

    fecha = date.today().isoformat()
    filas, fallidas = descargar(planes, ritmo, robots, fecha)
    for plan, preparada in fallidas:
        if plan.producto.codigo not in codigos_con_foto() and plan.dudosa is None:
            plan.dudosa = preparada
    for plan in planes:
        if plan.producto.codigo in codigos_con_foto() or plan.producto.codigo in {f.codigo for f in filas}:
            continue
        if plan.dudosa is None:
            continue
        entrada = plan.dudosa.entrada
        filas.append(
            Fila(
                plan.producto.codigo,
                plan.producto.nombre,
                "",
                entrada.fuente,
                entrada.url_producto,
                entrada.url_imagen,
                "dudosa",
                fecha,
            )
        )
    escribir_csv(filas)
    limpiar_huerfanos(filas)
    cuenta = escribir_estado(planes, filas, notas, fecha)
    exactas = sum(1 for f in filas if f.coincidencia == "exacta")
    print(f"fotos exactas: {exactas} · enlaces dudosos: {len(filas) - exactas}")
    print(
        "estado: "
        f"{cuenta['listo para indexar']} listos · "
        f"{cuenta['dudoso']} dudosos · "
        f"{cuenta['necesita foto propia']} necesitan foto propia"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
