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
