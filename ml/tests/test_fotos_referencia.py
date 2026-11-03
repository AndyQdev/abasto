from __future__ import annotations

import pytest

import abasto_ml.vision.fotos_referencia as fr
from abasto_ml.vision.fotos_referencia import (
    Entrada,
    Fila,
    Plan,
    Preparada,
    Producto,
    _entradas_de_urlset,
    cantidades,
    coincidencia,
    escribir_estado,
    guardar_foto,
    leer_catalogo,
    limpiar_huerfanos,
    parecido,
    presentacion_de_guabira,
    tokens,
)

EXACTAS = [
    ("Azúcar Guabirá 1 kg", "Azucar Guabira de 1 K"),
    ("Huevo · maple de 30", "Huevos Sofia Marrón Mediano 30 unidades"),
    ("Vasos descartables 250 ml · paquete de 100", "Belen Vasos Desechables De 250Ml X 100 Unidades"),
    ("Azúcar · quintal 46 kg", "Azucar Extra Fina 46 kg"),
    ("Leche PIL enriquecida 800 ml", "Leche Pil Enriquecida Bolsa 800 Ml"),
    ("Papel higiénico Elite Plus · 24 rollos", "Papel Higienico Elite Plus Doble Hoja X 24 Rollos"),
    ("Fideo spaghetti Don Vittorio 500 g", "Fideo Spaghetti Don Victorio 500 Gr"),
    ("Jabón Protex Avena · 3 de 110 g", "Pack Jabon Protex Avena 110G X 3 Unidades"),
    ("Agua Vital sin gas 2 L", "Agua Vital Sin Gas X 2 L"),
    ("Harina de trigo · quintal 46 kg", "Harina De Trigo Kantuta 46 Kg"),
]

DUDOSAS = [
    ("Aceite vegetal · bidón 5 L", "Aceite Fino Vegetal X 1.8L"),
    ("Harina de trigo · quintal 46 kg", "Harina Trigo Famosa 1 Kg"),
    ("Mantequilla PIL con sal 200 g", "Mantequilla Sin Sal Pil 200 Gr"),
    ("Azúcar Guabirá 1 kg", "Azúcar Morena Guabirá 1 kg"),
    ("Harina Famosa 1 kg", "Harina Famosa De Trigo 0000 X 1Kg"),
]

SIN_COINCIDENCIA = [
    ("Comino molido 500 g", "Café Molido 500 g"),
    ("Vasos descartables 250 ml · paquete de 100", "Platos descartables 250 ml x 100"),
    ("Bolsas plásticas medianas · paquete de 100", "Bolsas de basura 100 unidades"),
    (
        "Envase de plastoformo con tapa · paquete de 100",
        "La Reina Mielera Jalea Con Propoleo Envase X 30 Sachet",
    ),
]


@pytest.mark.parametrize(("nombre", "titulo"), EXACTAS)
def test_coincidencia_exacta(nombre: str, titulo: str) -> None:
    assert coincidencia(nombre, titulo) == "exacta"


@pytest.mark.parametrize(("nombre", "titulo"), DUDOSAS)
def test_coincidencia_dudosa(nombre: str, titulo: str) -> None:
    assert coincidencia(nombre, titulo) == "dudosa" or parecido(nombre, titulo) > 0.0


@pytest.mark.parametrize(("nombre", "titulo"), SIN_COINCIDENCIA)
def test_sin_coincidencia(nombre: str, titulo: str) -> None:
    assert coincidencia(nombre, titulo) is None


def test_cantidades_entiende_presentaciones() -> None:
    assert cantidades("Azúcar · quintal 46 kg") == frozenset({("g", 46000.0)})
    assert ("g", 11500.0) in cantidades("Harina de trigo · arroba 11,5 kg")
    assert ("u", 30.0) in cantidades("Huevo · maple de 30")
    assert ("u", 100.0) in cantidades("Vasos · paquete de 100")
    assert ("u", 3.0) in cantidades("Jabón · 3 de 110 g")
    assert ("g", 110.0) in cantidades("Jabón · 3 de 110 g")
    assert ("ml", 1000.0) in cantidades("Yogurt 1 L")
    assert ("g", 1000.0) in cantidades("Azucar Guabira de 1 K")


def test_tokens_normaliza_marcas_y_variantes() -> None:
    assert tokens("Galleta wafer Mabel's chocolate 100 g") == ("galleta", "wafer", "mabel", "chocolate")
    assert "vittorio" in tokens("Fideo Don Victorio")
    assert "descartable" in tokens("Vasos desechables")
    assert "con" not in tokens("Mantequilla con sal")


def test_parecido_descarta_snacks_para_frescos() -> None:
    assert parecido("Cebolla · arroba 11,5 kg", "Papas Pringles Crema y Cebolla 124 Gr") == 0.0
    assert parecido("Papa · arroba 11,5 kg", "Papa Simplot 2 Kg") > 0.0


def test_descarta_fotos_que_no_son_de_producto() -> None:
    assert not fr._foto_utilizable("https://cdn.shopify.com/WhatsAppImage2026-02-23.jpg")
    assert not fr._foto_utilizable("https://cdn.shopify.com/placeholder.png")
    assert fr._foto_utilizable("https://cdn.shopify.com/azucar.png")


def test_parsea_html_de_guabira() -> None:
    enlaces = fr._Enlaces(r"/azucar/[a-z0-9-]+")
    enlaces.feed('<a href="/azucar/extrafina">Extra fina</a><a href="/contacto">Contacto</a>')
    assert enlaces.enlaces == ["/azucar/extrafina"]
    imagenes = fr._Imagenes()
    imagenes.feed('<img src="/public/img/presentations/azucar_extrafina_46kg.png" alt="46 kg">')
    assert imagenes.fuentes == ["/public/img/presentations/azucar_extrafina_46kg.png"]


def test_presentacion_de_guabira() -> None:
    assert presentacion_de_guabira("azucar_extrafina_46kg.png") == "46 kg"
    assert presentacion_de_guabira("azucar-extrafina-arroba.png") == "arroba"
    assert presentacion_de_guabira("azucar-extrafina-1kg.webp") == "1 kg"
    assert presentacion_de_guabira("azucar-extrafina-200-6g.webp") == "200 sachet de 6 g"
    assert presentacion_de_guabira("logo.png") == ""


def test_leer_catalogo(tmp_path) -> None:
    php = tmp_path / "SembrarAbasto.php"
    php.write_text(
        "['AB-001', 'Arroz Caisy Grano de Oro 1 kg', 'Granos'],\n"
        "['AB-020', 'Galleta wafer Mabel\\'s chocolate 100 g', 'Galletas'],\n",
        encoding="utf-8",
    )
    productos = leer_catalogo(php)
    assert [p.codigo for p in productos] == ["AB-001", "AB-020"]
    assert productos[1].nombre == "Galleta wafer Mabel's chocolate 100 g"


def test_catalogo_real_tiene_138_productos() -> None:
    assert len(leer_catalogo()) == 138


def test_las_ilustraciones_3d_no_cuentan_como_foto_real() -> None:
    con_foto = fr.codigos_con_foto()
    assert len(con_foto) == 27
    assert "AB-001" in con_foto
    assert "AB-101" not in con_foto  # harina por quintal: ilustración genérica


def test_lee_sitemap_de_productos() -> None:
    xml = """<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
            xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
      <url>
        <loc>https://www.fidalga.com/products/azucar-guabira-1-k</loc>
        <image:image>
          <image:loc>https://cdn.shopify.com/azucar.png</image:loc>
          <image:title>Azucar Guabira de 1 K</image:title>
        </image:image>
      </url>
    </urlset>"""
    entradas = _entradas_de_urlset(xml)
    assert len(entradas) == 1
    assert entradas[0].titulo == "Azucar Guabira de 1 K"
    assert entradas[0].url_imagen == "https://cdn.shopify.com/azucar.png"
    assert entradas[0].url_producto == "https://www.fidalga.com/products/azucar-guabira-1-k"


def test_guardar_foto_deduplica_por_sha1(tmp_path) -> None:
    datos = b"\x89PNG\r\n\x1a\n" + b"contenido"
    usados: dict[str, object] = {}
    carpeta = tmp_path / "AB-001"
    ruta = guardar_foto(datos, "https://cdn.shopify.com/azucar.png", carpeta, usados)
    assert ruta is not None
    assert ruta.parent == carpeta
    assert ruta.suffix == ".png"
    assert guardar_foto(datos, "https://cdn.shopify.com/azucar.png", carpeta, usados) == ruta
    assert guardar_foto(datos, "https://cdn.shopify.com/azucar.png", tmp_path / "AB-002", usados) is None


def test_limpiar_huerfanos(tmp_path) -> None:
    destino = tmp_path / "datos" / "fotos-referencia" / "AB-001"
    destino.mkdir(parents=True)
    buena = destino / "buena.jpg"
    mala = destino / "mala.jpg"
    buena.write_bytes(b"a")
    mala.write_bytes(b"b")
    fila = Fila(
        "AB-001",
        "Arroz",
        "datos/fotos-referencia/AB-001/buena.jpg",
        "Fidalga",
        "https://x/p",
        "https://x/i.jpg",
        "exacta",
        "2026-11-02",
    )
    limpiar_huerfanos([fila], destino=tmp_path / "datos" / "fotos-referencia", raiz=tmp_path)
    assert buena.exists()
    assert not mala.exists()


def test_estado_no_cuenta_una_dudosa_como_foto(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(fr, "ESTADO", tmp_path / "estado.md")
    monkeypatch.setattr(fr, "codigos_con_foto", lambda *args, **kwargs: set())
    producto = Producto("AB-101", "Harina de trigo · quintal 46 kg")
    entrada = Entrada("Fidalga", "Harina Trigo Famosa 1 Kg", "https://x/p", "https://x/i.jpg")
    plan = Plan(producto, [], Preparada(entrada, frozenset(), ()))
    fila = Fila("AB-101", producto.nombre, "", "Fidalga", "https://x/p", "https://x/i.jpg", "dudosa", "2026-11-02")
    cuenta = escribir_estado([plan], [fila], [], "2026-11-02")
    assert cuenta == {"listo para indexar": 0, "dudoso": 1, "necesita foto propia": 0}
    texto = (tmp_path / "estado.md").read_text(encoding="utf-8")
    assert "| AB-101 | Harina de trigo · quintal 46 kg | no | 0 (1 dudosa) | dudoso |" in texto
