"""Supervisado (regresión): cuántas unidades se van a vender de cada producto la próxima semana.

Lo usa el agente de Reposición para avisar antes de que el stock se acabe.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_percentage_error


def caracteristicas(ventas: pd.DataFrame) -> pd.DataFrame:
    df = ventas.sort_values(["producto_id", "fecha"]).copy()
    df["dia_semana"] = df["fecha"].dt.dayofweek
    df["t"] = (df["fecha"] - df["fecha"].min()).dt.days
    por_producto = df.groupby("producto_id")["unidades"]
    df["media_7"] = por_producto.transform(lambda s: s.shift(1).rolling(7).mean())
    df["media_28"] = por_producto.transform(lambda s: s.shift(1).rolling(28).mean())
    df["producto"] = df["producto_id"].astype("category").cat.codes
    return df.dropna()


COLUMNAS = ["dia_semana", "t", "media_7", "media_28", "producto"]


@dataclass
class ModeloDeDemanda:
    modelo: GradientBoostingRegressor
    error_porcentual: float


def entrenar(ventas: pd.DataFrame, semilla: int = 7) -> ModeloDeDemanda:
    """Entrena con todo menos las últimas 4 semanas, que se usan para medir el error."""
    df = caracteristicas(ventas)
    corte = df["fecha"].max() - pd.Timedelta(days=28)
    entrenamiento, validacion = df[df["fecha"] <= corte], df[df["fecha"] > corte]
    modelo = GradientBoostingRegressor(random_state=semilla, n_estimators=200, max_depth=3)
    modelo.fit(entrenamiento[COLUMNAS], entrenamiento["unidades"])
    error = mean_absolute_percentage_error(validacion["unidades"], modelo.predict(validacion[COLUMNAS]))
    return ModeloDeDemanda(modelo, float(error))


def semana_siguiente(m: ModeloDeDemanda, ventas: pd.DataFrame) -> pd.DataFrame:
    """Unidades esperadas por producto para la semana que viene (suma de 7 días)."""
    ultimo = caracteristicas(ventas).groupby("producto_id").tail(1)
    filas = []
    for _, fila in ultimo.iterrows():
        total = 0.0
        for d in range(1, 8):
            x = fila[COLUMNAS].copy()
            x["t"] = fila["t"] + d
            x["dia_semana"] = (fila["dia_semana"] + d) % 7
            total += float(m.modelo.predict(pd.DataFrame([x[COLUMNAS]]))[0])
        filas.append((fila["producto_id"], round(total, 1)))
    return pd.DataFrame(filas, columns=["producto_id", "unidades"])
