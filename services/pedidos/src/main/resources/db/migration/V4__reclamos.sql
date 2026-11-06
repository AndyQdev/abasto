-- 06/11/2026 · CU-16: la tienda reporta un problema con un pedido y Abasto lo resuelve a mano.
-- El sistema solo anota lo que se devolvió: no mueve dinero, crédito ni cuentas por cobrar.
CREATE TABLE reclamos (
    id                uuid        PRIMARY KEY,
    -- Uno por pedido: el doble toque o el reenvío devuelven el mismo
    pedido_id         uuid        NOT NULL UNIQUE REFERENCES pedidos (id),
    tienda_id         text        NOT NULL,
    mayorista_id      text        NOT NULL,
    motivo            text        NOT NULL,
    detalle           text,
    estado            text        NOT NULL,
    respuesta         text,
    devuelto_centavos bigint      CHECK (devuelto_centavos >= 0),
    forma             text,
    resuelto_por      text,
    creado_en         timestamptz NOT NULL,
    resuelto_en       timestamptz
);

CREATE INDEX reclamos_por_estado ON reclamos (estado, creado_en DESC);
