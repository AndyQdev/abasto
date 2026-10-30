"""Pruebas de la revisión del dataset de fotos."""

from pathlib import Path

import pytest

from abasto_ml.vision import fotos


def test_contar_cuenta_solo_extensiones_validas_sin_importar_mayusculas(tmp_path: Path):
    carpeta = tmp_path / "AR-0100"
    carpeta.mkdir()
    (carpeta / "a.JPG").write_bytes(b"")
    (carpeta / "b.jpeg").write_bytes(b"")
    (carpeta / "c.png").write_bytes(b"")
    (carpeta / "d.webp").write_bytes(b"")
    (carpeta / "nota.txt").write_text("")
    (carpeta / "sub").mkdir()
    (carpeta / "sub" / "e.jpg").write_bytes(b"")
    (tmp_path / "suelta.jpg").write_bytes(b"")

    assert fotos.contar(tmp_path) == {"AR-0100": 4}


def test_contar_devuelve_vacio_si_la_carpeta_no_existe(tmp_path: Path):
    assert fotos.contar(tmp_path / "no-existe") == {}


def test_faltantes_lista_los_codigos_con_pocas_fotos_ordenados():
    conteo = {"B": 3, "A": 20, "C": 0}
    assert fotos.faltantes(conteo, minimo=15) == ["B", "C"]


def test_crear_carpetas_es_idempotente(tmp_path: Path):
    primera = fotos.crear_carpetas(tmp_path, ["AR-0100", "AZ-1000"])
    segunda = fotos.crear_carpetas(tmp_path, ["AR-0100", "AZ-1000"])

    assert primera == segunda
    assert [ruta.name for ruta in primera] == ["AR-0100", "AZ-1000"]
    assert all(ruta.is_dir() for ruta in primera)


def test_main_con_crear_arma_las_carpetas_de_la_demo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr("sys.argv", ["fotos", "--fotos", str(tmp_path), "--crear"])

    fotos.main()

    for codigo in fotos.PRODUCTOS_DE_LA_DEMO:
        assert (tmp_path / codigo).is_dir()


def test_main_avisa_y_sale_con_error_si_faltan_fotos(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
):
    (tmp_path / "AR-0100").mkdir()
    (tmp_path / "AR-0100" / "a.jpg").write_bytes(b"")
    monkeypatch.setattr("sys.argv", ["fotos", "--fotos", str(tmp_path), "--minimo", "2"])

    with pytest.raises(SystemExit) as salida:
        fotos.main()

    assert salida.value.code == 1
    assert "Faltan fotos en:" in capsys.readouterr().out


def test_main_no_falla_cuando_cada_producto_tiene_fotos(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    for codigo in fotos.PRODUCTOS_DE_LA_DEMO:
        carpeta = tmp_path / codigo
        carpeta.mkdir()
        (carpeta / "a.jpg").write_bytes(b"")
    monkeypatch.setattr("sys.argv", ["fotos", "--fotos", str(tmp_path), "--minimo", "1"])

    fotos.main()
