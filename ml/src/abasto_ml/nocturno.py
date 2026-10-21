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
