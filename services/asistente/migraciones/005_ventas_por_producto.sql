-- Ventas por producto y por día (10/11): para «¿qué producto vendí más en septiembre?», «¿cómo vienen las ventas
-- del arroz mes a mes?». La llena el proyector con las líneas de pedido.confirmado (cuando el evento las trae)
-- y la carga masiva de datos (`scripts/carga-masiva.mjs`).
-- producto_nombre se copia de stock_productos al proyectar; si el producto no está ahí, queda el id.

CREATE TABLE ventas_por_producto (
    org_id          text   NOT NULL,
    fecha           date   NOT NULL,
    producto_id     text   NOT NULL,
    producto_nombre text   NOT NULL,
    unidades        integer NOT NULL DEFAULT 0,
    total_centavos  bigint NOT NULL DEFAULT 0,
    PRIMARY KEY (org_id, fecha, producto_id)
);

CREATE INDEX ventas_por_producto_por_producto ON ventas_por_producto (org_id, producto_id, fecha);

ALTER TABLE ventas_por_producto ENABLE ROW LEVEL SECURITY;
CREATE POLICY solo_su_empresa ON ventas_por_producto FOR SELECT TO mcp_lector
    USING (org_id = current_setting('abasto.org_id', true));
GRANT SELECT ON ventas_por_producto TO mcp_lector;
