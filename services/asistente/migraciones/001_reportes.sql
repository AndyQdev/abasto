-- Base `reportes`: vista de solo lectura que arma el proyector con los eventos de todos los servicios
-- (CQRS). Los reportes frecuentes salen de aquí y no cargan las bases que escriben.
-- Dueño: usuario `reportes` (Asistente). Lee: `mcp_lector`, solo las filas de su empresa.

CREATE TABLE ventas_diarias (
    org_id         text    NOT NULL,
    fecha          date    NOT NULL,
    pedidos        integer NOT NULL DEFAULT 0,
    total_centavos bigint  NOT NULL DEFAULT 0,
    PRIMARY KEY (org_id, fecha)
);

CREATE TABLE cuentas_por_cobrar (
    org_id         text   NOT NULL,
    pedido_id      text   NOT NULL,
    tienda_id      text   NOT NULL,
    tienda_nombre  text   NOT NULL,
    saldo_centavos bigint NOT NULL,
    vence          date   NOT NULL,
    estado         text   NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'vencida', 'pagada')),
    PRIMARY KEY (org_id, pedido_id)
);

CREATE TABLE stock_productos (
    org_id           text          NOT NULL,
    producto_id      text          NOT NULL,
    nombre           text          NOT NULL,
    stock            integer       NOT NULL,
    vendidas_por_dia numeric(10, 2) NOT NULL DEFAULT 0,
    PRIMARY KEY (org_id, producto_id)
);

CREATE TABLE prediccion_demanda (
    org_id      text           NOT NULL,
    producto_id text           NOT NULL,
    semana      date           NOT NULL,
    unidades    numeric(12, 2) NOT NULL,
    PRIMARY KEY (org_id, producto_id, semana)
);

CREATE TABLE segmento_tiendas (
    org_id                   text          NOT NULL,
    tienda_id                text          NOT NULL,
    tienda_nombre            text          NOT NULL,
    segmento                 text          NOT NULL,
    compras_mes              numeric(10, 2) NOT NULL DEFAULT 0,
    ticket_promedio_centavos bigint        NOT NULL DEFAULT 0,
    PRIMARY KEY (org_id, tienda_id)
);

-- Inbox del proyector: un evento repetido no se proyecta dos veces
CREATE TABLE eventos_proyectados (
    id            text        PRIMARY KEY,
    tipo          text        NOT NULL,
    proyectado_en timestamptz NOT NULL DEFAULT now()
);

-- Seguridad por fila: mcp_lector solo ve las filas cuyo org_id es el de la sesión
DO $$
DECLARE tabla text;
BEGIN
    FOREACH tabla IN ARRAY ARRAY['ventas_diarias', 'cuentas_por_cobrar', 'stock_productos', 'prediccion_demanda', 'segmento_tiendas']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabla);
        EXECUTE format(
            'CREATE POLICY solo_su_empresa ON %I FOR SELECT TO mcp_lector USING (org_id = current_setting(''abasto.org_id'', true))',
            tabla);
        EXECUTE format('GRANT SELECT ON %I TO mcp_lector', tabla);
    END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO mcp_lector;
