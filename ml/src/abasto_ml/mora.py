"""Supervisado (clasificación): probabilidad de que un crédito se pague tarde.

Lo usa Cobros para sugerir el límite de crédito y el agente de Cobranza para priorizar.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

COLUMNAS = ["monto_bs", "plazo_dias", "atrasos_previos", "uso_del_limite", "antiguedad_meses"]


@dataclass
class ModeloDeMora:
    modelo: Pipeline
    auc: float


def entrenar(creditos: pd.DataFrame, semilla: int = 7) -> ModeloDeMora:
    x_ent, x_val, y_ent, y_val = train_test_split(
        creditos[COLUMNAS],
        creditos["pago_tarde"],
        test_size=0.25,
        random_state=semilla,
        stratify=creditos["pago_tarde"],
    )
    modelo = Pipeline([("escala", StandardScaler()), ("logistica", LogisticRegression(random_state=semilla))])
    modelo.fit(x_ent, y_ent)
    auc = roc_auc_score(y_val, modelo.predict_proba(x_val)[:, 1])
    return ModeloDeMora(modelo, float(auc))


def riesgo(m: ModeloDeMora, creditos: pd.DataFrame) -> pd.Series:
    return pd.Series(m.modelo.predict_proba(creditos[COLUMNAS])[:, 1], index=creditos.index, name="riesgo")


# La base `reportes` no guarda el límite de crédito de cada tienda: se compara lo que debe con un límite típico
LIMITE_DE_REFERENCIA_BS = 5000.0
PLAZO_POR_DEFECTO_DIAS = 15


def caracteristicas_de_tiendas(cuentas: pd.DataFrame, pedidos: pd.DataFrame, hoy: pd.Timestamp) -> pd.DataFrame:
    """Lo que el modelo necesita de cada tienda que tiene crédito, sacado de la base `reportes`.

    `cuentas`: org_id, tienda_id, tienda_nombre, saldo_centavos, vence, estado (cuentas_por_cobrar).
    `pedidos`: org_id, tienda_id, creado_en. Una tienda sin cuentas abiertas no entra (no debe nada).
    """
    abiertas = cuentas[cuentas["estado"] != "pagada"].copy()
    if abiertas.empty:
        return pd.DataFrame(columns=["org_id", "tienda_id", "tienda_nombre", "saldo_centavos", "cuentas_vencidas", *COLUMNAS])
    hoy = pd.Timestamp(hoy).normalize()
    abiertas["vencida"] = (abiertas["estado"] == "vencida") | (pd.to_datetime(abiertas["vence"]) < hoy)
    por_tienda = abiertas.groupby(["org_id", "tienda_id"], as_index=False).agg(
        tienda_nombre=("tienda_nombre", "max"),
        saldo_centavos=("saldo_centavos", "sum"),
        cuentas_vencidas=("vencida", "sum"),
    )
    # Atrasos previos = cuentas abiertas que ya pasaron su fecha. `reportes` no guarda si una cuenta pagada se pagó
    # tarde, así que es un mínimo. La antigüedad sale del primer pedido de la tienda.
    primera = (
        pedidos.assign(creado_en=pd.to_datetime(pedidos["creado_en"], utc=True).dt.tz_localize(None))
        .groupby(["org_id", "tienda_id"])["creado_en"]
        .min()
        .rename("primera")
        .reset_index()
        if not pedidos.empty
        else pd.DataFrame(columns=["org_id", "tienda_id", "primera"])
    )
    t = por_tienda.merge(primera, on=["org_id", "tienda_id"], how="left")
    meses = ((hoy - pd.to_datetime(t["primera"])).dt.days / 30).fillna(1).clip(lower=1)
    t["monto_bs"] = t["saldo_centavos"] / 100
    t["plazo_dias"] = PLAZO_POR_DEFECTO_DIAS
    t["atrasos_previos"] = t["cuentas_vencidas"].astype(int)
    t["uso_del_limite"] = (t["monto_bs"] / LIMITE_DE_REFERENCIA_BS).clip(upper=1.0)
    t["antiguedad_meses"] = meses.round().astype(int)
    t["cuentas_vencidas"] = t["cuentas_vencidas"].astype(int)
    return t.drop(columns=["primera"])
