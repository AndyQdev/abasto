-- Riesgo de que cada tienda pague tarde: lo escribe el ML nocturno (`ml/src/abasto_ml/mora.py`, regresión
-- logística supervisada) con lo que la tienda debe y cómo pagó antes. Lo leen Tableros, el Analista y el MCP.

CREATE TABLE riesgo_mora (
    org_id           text          NOT NULL,
    tienda_id        text          NOT NULL,
    tienda_nombre    text          NOT NULL,
    riesgo           numeric(5, 4) NOT NULL CHECK (riesgo BETWEEN 0 AND 1),
    saldo_centavos   bigint        NOT NULL DEFAULT 0,
    cuentas_vencidas integer       NOT NULL DEFAULT 0,
    actualizado_en   timestamptz   NOT NULL DEFAULT now(),
    PRIMARY KEY (org_id, tienda_id)
);

ALTER TABLE riesgo_mora ENABLE ROW LEVEL SECURITY;
CREATE POLICY solo_su_empresa ON riesgo_mora FOR SELECT TO mcp_lector
    USING (org_id = current_setting('abasto.org_id', true));
GRANT SELECT ON riesgo_mora TO mcp_lector;
