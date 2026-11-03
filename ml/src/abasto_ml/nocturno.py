"""Proceso nocturno: entrena, mide y escribe las predicciones en la base `reportes`.

n8n lo dispara cada noche. También se puede correr a mano: `uv run abasto-ml-nocturno`.
Sin REPORTES_URL solo entrena y muestra las métricas (útil para probar).
"""

from __future__ import annotations

import os

import pandas as pd

from abasto_ml import datos, demanda, mora, segmentos


def main() -> None:
    ventas = datos.ventas_diarias()
    m_demanda = demanda.entrenar(ventas)
    m_mora = mora.entrenar(datos.creditos())
    seg, silueta = segmentos.segmentar(datos.compras_por_tienda())
    proxima = demanda.semana_siguiente(m_demanda, ventas)

    print(f"Demanda: error porcentual {m_demanda.error_porcentual:.1%}")
    print(f"Mora: AUC {m_mora.auc:.3f}")
    print(f"Segmentos: silueta {silueta:.3f} · {seg['segmento'].value_counts().to_dict()}")

    url = os.environ.get("REPORTES_URL")
    if not url:
        print("Sin REPORTES_URL: no se escribe en la base")
        return
    _guardar(url, proxima, seg)
    _guardar_riesgo_de_mora(url, m_mora)


def _guardar_riesgo_de_mora(url: str, m_mora: mora.ModeloDeMora) -> None:
    """Riesgo de pago tarde de cada tienda que debe algo, con sus cuentas reales de la base `reportes`."""
    import psycopg

    with psycopg.connect(url) as conexion, conexion.cursor() as cursor:
        cursor.execute("SELECT org_id, tienda_id, tienda_nombre, saldo_centavos, vence, estado FROM cuentas_por_cobrar")
        cuentas = pd.DataFrame(cursor.fetchall(), columns=[c.name for c in cursor.description])
        cursor.execute("SELECT org_id, tienda_id, creado_en FROM pedidos")
        pedidos = pd.DataFrame(cursor.fetchall(), columns=[c.name for c in cursor.description])
        tiendas = mora.caracteristicas_de_tiendas(cuentas, pedidos, pd.Timestamp.today())
        if tiendas.empty:
            print("Riesgo de mora: ninguna tienda debe nada")
            return
        tiendas["riesgo"] = mora.riesgo(m_mora, tiendas).round(4)
        # Lo que ya no se debe sale del tablero
        cursor.execute("DELETE FROM riesgo_mora")
        for fila in tiendas.itertuples():
            cursor.execute(
                """INSERT INTO riesgo_mora (org_id, tienda_id, tienda_nombre, riesgo, saldo_centavos, cuentas_vencidas)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (fila.org_id, fila.tienda_id, fila.tienda_nombre, float(fila.riesgo), int(fila.saldo_centavos), int(fila.cuentas_vencidas)),
            )
    print(f"Guardado el riesgo de mora de {len(tiendas)} tiendas")


def _guardar(url: str, proxima: pd.DataFrame, seg: pd.DataFrame, org_id: str = "lp") -> None:
    import psycopg

    lunes = (pd.Timestamp.today().normalize() + pd.offsets.Week(weekday=0)).date()
    with psycopg.connect(url) as conexion, conexion.cursor() as cursor:
        for fila in proxima.itertuples():
            cursor.execute(
                """INSERT INTO prediccion_demanda (org_id, producto_id, semana, unidades) VALUES (%s, %s, %s, %s)
                   ON CONFLICT (org_id, producto_id, semana) DO UPDATE SET unidades = EXCLUDED.unidades""",
                (org_id, fila.producto_id, lunes, fila.unidades),
            )
        for fila in seg.itertuples():
            cursor.execute(
                """INSERT INTO segmento_tiendas (org_id, tienda_id, tienda_nombre, segmento, compras_mes, ticket_promedio_centavos)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   ON CONFLICT (org_id, tienda_id) DO UPDATE SET segmento = EXCLUDED.segmento,
                     compras_mes = EXCLUDED.compras_mes, ticket_promedio_centavos = EXCLUDED.ticket_promedio_centavos""",
                (
                    org_id,
                    fila.tienda_id,
                    fila.tienda_id,
                    fila.segmento,
                    fila.compras_mes,
                    int(fila.ticket_promedio_bs * 100),
                ),
            )
    print(f"Guardadas {len(proxima)} predicciones de demanda y {len(seg)} segmentos")


if __name__ == "__main__":
    main()
