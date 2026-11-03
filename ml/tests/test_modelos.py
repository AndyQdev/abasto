"""Pruebas de los modelos: umbrales mínimos y resultados repetibles con la misma semilla."""

from abasto_ml import datos, demanda, mora, segmentos


def test_los_datos_sinteticos_son_repetibles():
    assert datos.creditos(semilla=7).equals(datos.creditos(semilla=7))
    assert not datos.creditos(semilla=7).equals(datos.creditos(semilla=8))


def test_la_demanda_se_equivoca_menos_de_15_por_ciento():
    m = demanda.entrenar(datos.ventas_diarias())
    assert m.error_porcentual < 0.15


def test_la_prediccion_de_la_semana_trae_todos_los_productos():
    ventas = datos.ventas_diarias()
    proxima = demanda.semana_siguiente(demanda.entrenar(ventas), ventas)
    assert set(proxima["producto_id"]) == set(datos.PRODUCTOS)
    assert (proxima["unidades"] > 0).all()


def test_el_modelo_de_mora_distingue_mejor_que_el_azar():
    m = mora.entrenar(datos.creditos())
    assert m.auc > 0.70


def test_mas_atrasos_previos_dan_mas_riesgo():
    m = mora.entrenar(datos.creditos())
    base = datos.creditos().head(1).copy()
    atrasado = base.assign(atrasos_previos=5)
    assert mora.riesgo(m, atrasado).iloc[0] > mora.riesgo(m, base.assign(atrasos_previos=0)).iloc[0]


def test_el_riesgo_de_cada_tienda_sale_de_sus_cuentas_reales():
    import pandas as pd

    cuentas = pd.DataFrame(
        [
            ("lp", "es", "Tienda La Esquina", 75600, "2026-10-31", "vencida"),
            ("lp", "es", "Tienda La Esquina", 300000, "2026-10-30", "pendiente"),
            ("lp", "sj", "Tienda San Juan", 42000, "2026-11-04", "pendiente"),
            ("lp", "dr", "Tienda Doña Rosa", 120000, "2026-10-01", "pagada"),
        ],
        columns=["org_id", "tienda_id", "tienda_nombre", "saldo_centavos", "vence", "estado"],
    )
    pedidos = pd.DataFrame(
        [("lp", "es", "2026-10-01T10:00:00Z"), ("lp", "sj", "2025-11-01T10:00:00Z")],
        columns=["org_id", "tienda_id", "creado_en"],
    )
    t = mora.caracteristicas_de_tiendas(cuentas, pedidos, pd.Timestamp("2026-11-03"))

    # Doña Rosa ya pagó todo: no entra
    assert set(t["tienda_id"]) == {"es", "sj"}
    esquina = t.set_index("tienda_id").loc["es"]
    assert (esquina["saldo_centavos"], esquina["cuentas_vencidas"], esquina["antiguedad_meses"]) == (375600, 2, 1)
    m = mora.entrenar(datos.creditos())
    r = mora.riesgo(m, t).set_axis(t["tienda_id"])
    # Dos cuentas vencidas y poca antigüedad pesan más que una cuenta al día de una tienda de hace un año
    assert r["es"] > r["sj"]
    assert ((r >= 0) & (r <= 1)).all()


def test_kmeans_es_repetible_y_separa_bien():
    a, silueta = segmentos.segmentar(datos.compras_por_tienda())
    b, _ = segmentos.segmentar(datos.compras_por_tienda())
    assert (a["grupo"] == b["grupo"]).all()
    assert silueta > 0.4
    assert a["segmento"].nunique() == 3
