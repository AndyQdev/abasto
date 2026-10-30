"""Visión: vectores del catálogo (siempre) y paridad Keras = TFLite (solo con el grupo `vision`)."""

import json

import numpy as np
import pytest

from abasto_ml.vision import vectores


def test_normalizar_deja_norma_uno_y_no_divide_por_cero():
    v = vectores.normalizar(np.array([[3.0, 4.0], [0.0, 0.0]], dtype=np.float32))
    assert np.allclose(v[0], [0.6, 0.8])
    assert np.array_equal(v[1], [0.0, 0.0])


def test_el_vector_de_un_producto_promedia_sus_fotos_sin_que_pese_el_tamano():
    fotos = np.array([[10.0, 0.0], [0.0, 1.0], [5.0, 5.0]], dtype=np.float32)
    por_codigo = vectores.promedio_por_producto(fotos, ["AR-0100", "AR-0100", "AZ-1000"])
    assert set(por_codigo) == {"AR-0100", "AZ-1000"}
    # Una foto con vector «grande» no tapa a la otra: el promedio queda a 45°
    assert np.allclose(por_codigo["AR-0100"], [np.sqrt(0.5), np.sqrt(0.5)])
    assert np.isclose(np.linalg.norm(por_codigo["AZ-1000"]), 1.0)


def test_rechaza_cantidades_distintas_de_vectores_y_codigos():
    with pytest.raises(ValueError, match="2 vectores y 1 códigos"):
        vectores.promedio_por_producto(np.ones((2, 3)), ["AR-0100"])


def test_escribe_el_formato_que_lee_la_app(tmp_path):
    destino = tmp_path / "modelos" / "vectores.json"
    vectores.escribir(
        destino, "productos-v1", {"AZ-1000": np.array([0.0, 1.0]), "AR-0100": np.array([1 / 3, 0.9])}
    )
    datos = json.loads(destino.read_text(encoding="utf-8"))
    assert datos["modelo"] == "productos-v1"
    assert datos["dimension"] == 2
    assert [p["codigo"] for p in datos["productos"]] == ["AR-0100", "AZ-1000"]
    assert datos["productos"][0]["vector"] == [0.33333, 0.9]


def test_no_escribe_vectores_de_largos_distintos(tmp_path):
    with pytest.raises(ValueError, match="largos distintos"):
        vectores.escribir(tmp_path / "v.json", "m", {"A": np.ones(3), "B": np.ones(4)})


def test_el_tflite_responde_igual_que_keras():
    tf = pytest.importorskip("tensorflow")
    from abasto_ml.vision import entrenar

    modelo, _ = entrenar.construir(categorias=4)
    interprete = tf.lite.Interpreter(model_content=entrenar.a_tflite(modelo))
    interprete.allocate_tensors()
    entrada = interprete.get_input_details()[0]
    salidas = {d["shape"][-1]: d["index"] for d in interprete.get_output_details()}

    fotos = np.random.default_rng(7).uniform(0, 255, size=(3, 224, 224, 3)).astype(np.float32)
    for foto in fotos:
        keras = modelo(foto[None], training=False)
        interprete.set_tensor(entrada["index"], foto[None])
        interprete.invoke()
        vector = interprete.get_tensor(salidas[576])[0]
        clases = interprete.get_tensor(salidas[4])[0]
        coseno = np.dot(vector, keras["vector"][0]) / (
            np.linalg.norm(vector) * np.linalg.norm(keras["vector"][0])
        )
        # Los pesos en float16 mueven un poco los números, pero no la dirección del vector ni la clase ganadora
        assert coseno > 0.995
        assert np.argmax(clases) == np.argmax(keras["probabilidades"][0])


def test_el_catalogo_toma_el_codigo_del_nombre_de_cada_foto(tmp_path):
    from abasto_ml.vision import catalogo

    for nombre in ["AB-002.webp", "AB-001.JPG", "LEEME.md", "notas.txt"]:
        (tmp_path / nombre).write_bytes(b"")
    assert list(catalogo.leer_fotos(tmp_path)) == ["AB-001", "AB-002"]


def test_las_vistas_de_una_foto_son_del_tamano_del_modelo_y_la_oscura_tiene_menos_luz():
    image = pytest.importorskip("PIL.Image")
    from abasto_ml.vision import catalogo

    foto = image.new("RGB", (640, 480), (200, 100, 50))
    vistas = catalogo.vistas(foto)
    assert len(vistas) == 2 * len(catalogo.RECORTES)
    assert all(v.shape == (224, 224, 3) and v.dtype == np.float32 for v in vistas)
    assert np.allclose(vistas[1], vistas[0] * 0.85)


def test_la_foto_de_celular_simulada_es_repetible_con_la_misma_semilla():
    image = pytest.importorskip("PIL.Image")
    from abasto_ml.vision import catalogo

    foto = image.new("RGB", (640, 640), (10, 120, 200))
    a = catalogo.como_foto_de_celular(foto, np.random.default_rng(3))
    b = catalogo.como_foto_de_celular(foto, np.random.default_rng(3))
    assert a.shape == (224, 224, 3)
    assert np.array_equal(a, b)
