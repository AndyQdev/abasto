"""Historial sintético con semilla fija, para entrenar y probar sin datos reales.

Imita lo que verá Abasto: tiendas que compran con distinta frecuencia y monto,
estacionalidad semanal (más pedidos el lunes y el viernes) y créditos que a veces se pagan tarde.
Con la misma semilla siempre sale lo mismo: las pruebas son repetibles.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

PRODUCTOS = ["HP-0400", "HP-0410", "HJ-0110", "HB-0090", "LP-0004", "HC-0250"]
TIPOS_DE_TIENDA = {
    # tipo: (pedidos por semana, cajas por pedido)
    "barrio": (1.0, 2),
    "minimarket": (2.5, 5),
    "revendedor": (0.5, 12),
}


def tiendas(n: int = 60, semilla: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(semilla)
    tipos = rng.choice(list(TIPOS_DE_TIENDA), size=n, p=[0.6, 0.3, 0.1])
    return pd.DataFrame(
        {
            "tienda_id": [f"t{i:03d}" for i in range(n)],
            "tipo": tipos,
            "antiguedad_meses": rng.integers(1, 36, size=n),
        }
    )


def ventas_diarias(semanas: int = 26, semilla: int = 7) -> pd.DataFrame:
    """Unidades vendidas por día y producto, con tendencia leve y estacionalidad semanal."""
    rng = np.random.default_rng(semilla)
    dias = pd.date_range("2026-04-01", periods=semanas * 7, freq="D")
    filas = []
    for i, producto in enumerate(PRODUCTOS):
        base = 20 + 8 * i
        for t, dia in enumerate(dias):
            semana = 1.25 if dia.dayofweek in (0, 4) else (0.6 if dia.dayofweek == 6 else 1.0)
            esperado = base * semana * (1 + 0.004 * t)
            filas.append((dia, producto, int(rng.poisson(esperado))))
    return pd.DataFrame(filas, columns=["fecha", "producto_id", "unidades"])


def creditos(n: int = 800, semilla: int = 7) -> pd.DataFrame:
    """Créditos otorgados y si se pagaron tarde (la etiqueta del modelo de mora)."""
    rng = np.random.default_rng(semilla)
    plazo = rng.choice([15, 30], size=n)
    monto = rng.gamma(2.0, 600.0, size=n)
    atrasos_previos = rng.poisson(0.6, size=n)
    uso_del_limite = rng.uniform(0.1, 1.0, size=n)
    antiguedad = rng.integers(1, 36, size=n)
    # Más atrasos previos, más uso del límite y menos antigüedad → más riesgo
    riesgo = -2.2 + 0.9 * atrasos_previos + 1.8 * uso_del_limite - 0.04 * antiguedad + 0.0002 * monto
    pago_tarde = rng.uniform(size=n) < 1 / (1 + np.exp(-riesgo))
    return pd.DataFrame(
        {
            "monto_bs": monto.round(2),
            "plazo_dias": plazo,
            "atrasos_previos": atrasos_previos,
            "uso_del_limite": uso_del_limite.round(3),
            "antiguedad_meses": antiguedad,
            "pago_tarde": pago_tarde.astype(int),
        }
    )


def compras_por_tienda(semilla: int = 7) -> pd.DataFrame:
    """Resumen de compra de cada tienda: lo que usa K-means para segmentar."""
    rng = np.random.default_rng(semilla)
    t = tiendas(semilla=semilla)
    frecuencia = [TIPOS_DE_TIENDA[x][0] for x in t["tipo"]]
    cajas = [TIPOS_DE_TIENDA[x][1] for x in t["tipo"]]
    t["compras_mes"] = (np.array(frecuencia) * 4.3 * rng.uniform(0.8, 1.2, len(t))).round(2)
    t["ticket_promedio_bs"] = (np.array(cajas) * 860 * rng.uniform(0.7, 1.3, len(t))).round(2)
    return t
