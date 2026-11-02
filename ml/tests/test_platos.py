"""Fotos de platos: qué licencias se aceptan y cómo se leen las carpetas (sin red ni TensorFlow)."""

from abasto_ml.vision import platos_wikimedia
from abasto_ml.vision.platos import fotos_por_plato


def test_solo_se_aceptan_licencias_libres():
    assert platos_wikimedia.licencia_permitida("CC BY-SA 4.0")
    assert platos_wikimedia.licencia_permitida("cc0")
    assert platos_wikimedia.licencia_permitida("Public domain")
    assert not platos_wikimedia.licencia_permitida("Fair use")
    assert not platos_wikimedia.licencia_permitida("")


def test_las_categorias_solo_traen_fotos(monkeypatch):
    respuesta = {
        "query": {
            "categorymembers": [{"title": "File:a.jpg"}, {"title": "File:b.svg"}, {"title": "File:c.PNG"}]
        }
    }
    monkeypatch.setattr(platos_wikimedia, "_pedir_json", lambda params: respuesta)
    assert platos_wikimedia.archivos_de_categoria("Silpancho") == ["File:a.jpg", "File:c.PNG"]


def test_lee_las_fotos_de_cada_plato(tmp_path):
    for nombre in ["salchipapa/a.jpg", "salchipapa/b.webp", "salchipapa/nota.txt", "silpancho/c.png"]:
        archivo = tmp_path / nombre
        archivo.parent.mkdir(parents=True, exist_ok=True)
        archivo.write_bytes(b"")
    fotos = fotos_por_plato(tmp_path)
    assert {p: [f.name for f in fs] for p, fs in fotos.items()} == {
        "salchipapa": ["a.jpg", "b.webp"],
        "silpancho": ["c.png"],
    }
    assert fotos_por_plato(tmp_path / "no-existe") == {}
