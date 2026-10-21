"""No supervisado (K-means): agrupa a las tiendas según cómo compran.

El Panel muestra los segmentos y el agente de Reposición los usa para saber a quién ofrecer qué.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

COLUMNAS = ["compras_mes", "ticket_promedio_bs"]


def segmentar(compras: pd.DataFrame, k: int = 3, semilla: int = 7) -> tuple[pd.DataFrame, float]:
    """Devuelve cada tienda con su segmento (con nombre legible) y la silueta del agrupamiento."""
    x = StandardScaler().fit_transform(np.log1p(compras[COLUMNAS]))
    modelo = KMeans(n_clusters=k, n_init=10, random_state=semilla).fit(x)
    resultado = compras.copy()
    resultado["grupo"] = modelo.labels_
    resultado["segmento"] = resultado["grupo"].map(_nombres(resultado))
    return resultado, float(silhouette_score(x, modelo.labels_))


def _nombres(df: pd.DataFrame) -> dict[int, str]:
    """Nombra cada grupo por su comportamiento, para que el mayorista lo entienda sin ver números.

    El de ticket más alto compra por caja; de los otros, el que compra más veces "compra seguido y poco";
    el resto compra poco.
    """
    medias = df.groupby("grupo")[COLUMNAS].mean()
    por_caja = int(medias["ticket_promedio_bs"].idxmax())
    resto = medias.drop(index=por_caja).sort_values("compras_mes", ascending=False)
    nombres = {por_caja: "Compra por caja, de vez en cuando"}
    for posicion, grupo in enumerate(resto.index):
        nombres[int(grupo)] = "Compra seguido y poco" if posicion == 0 else "Compra poco"
    return nombres
