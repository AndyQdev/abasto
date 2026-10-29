-- Pedidos proyectados desde los eventos pedido.* (Pedidos publica, Asistente proyecta).
-- Sirve para preguntas como «¿cuántos pedidos se rechazaron esta semana y por qué?».
-- estado sigue al último evento: PENDIENTE → POR_CONFIRMAR → CONFIRMADO, o RECHAZADO.

CREATE TABLE pedidos (
    org_id         text        NOT NULL,
    pedido_id      text        NOT NULL,
    codigo         text        NOT NULL,
    tienda_id      text        NOT NULL,
    tienda_nombre  text        NOT NULL,
    metodo_pago    text        NOT NULL CHECK (metodo_pago IN ('qr', 'credito')),
    total_centavos bigint      NOT NULL,
    estado         text        NOT NULL CHECK (estado IN ('PENDIENTE', 'POR_CONFIRMAR', 'CONFIRMADO', 'RECHAZADO')),
    motivo_rechazo text,
    creado_en      timestamptz NOT NULL,
    actualizado_en timestamptz NOT NULL,
    PRIMARY KEY (org_id, pedido_id)
);

CREATE INDEX pedidos_por_fecha ON pedidos (org_id, creado_en);

ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY solo_su_empresa ON pedidos FOR SELECT TO mcp_lector
    USING (org_id = current_setting('abasto.org_id', true));
GRANT SELECT ON pedidos TO mcp_lector;
