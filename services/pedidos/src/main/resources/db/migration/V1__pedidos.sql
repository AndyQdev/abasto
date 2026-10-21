-- Base `pedidos`. Una migración que ya está en main no se edita: se escribe V2, V3…

CREATE SEQUENCE pedido_codigo_seq START 1100;

CREATE TABLE pedidos (
    id             uuid        PRIMARY KEY,
    codigo         text        NOT NULL UNIQUE,
    -- La clave de idempotencia que generó la app: con la misma clave nunca hay dos pedidos
    clave          uuid        NOT NULL UNIQUE,
    tienda_id      text        NOT NULL,
    mayorista_id   text        NOT NULL,
    metodo_pago    text        NOT NULL CHECK (metodo_pago IN ('QR', 'CREDITO')),
    estado         text        NOT NULL,
    motivo_rechazo text,
    creado_en      timestamptz NOT NULL
);
CREATE INDEX pedidos_por_tienda ON pedidos (tienda_id, creado_en DESC);
CREATE INDEX pedidos_por_mayorista ON pedidos (mayorista_id, creado_en DESC);

CREATE TABLE lineas_de_pedido (
    pedido_id                uuid    NOT NULL REFERENCES pedidos (id) ON DELETE CASCADE,
    posicion                 integer NOT NULL,
    producto_id              text    NOT NULL,
    presentacion             text    NOT NULL,
    cantidad                 integer NOT NULL CHECK (cantidad > 0),
    unidades                 integer NOT NULL DEFAULT 0,
    -- Copia del precio del momento; se fija cuando Catálogo reserva
    precio_unitario_centavos bigint,
    PRIMARY KEY (pedido_id, posicion)
);

-- Estado de cada saga de compra (orquestada desde aquí)
CREATE TABLE sagas_de_compra (
    pedido_id             uuid        PRIMARY KEY REFERENCES pedidos (id),
    paso                  text        NOT NULL,
    stock_reservado       boolean     NOT NULL,
    cobrado               boolean     NOT NULL,
    vence_confirmacion_en timestamptz,
    version               bigint      NOT NULL DEFAULT 0
);
CREATE INDEX sagas_esperando_mayorista ON sagas_de_compra (vence_confirmacion_en) WHERE paso = 'ESPERANDO_MAYORISTA';

-- Outbox: los mensajes se escriben en la misma transacción que el cambio
CREATE TABLE outbox (
    id             uuid        PRIMARY KEY,
    clase          text        NOT NULL CHECK (clase IN ('COMANDO', 'EVENTO')),
    tipo           text        NOT NULL,
    correlation_id uuid,
    org_id         text        NOT NULL,
    datos          jsonb       NOT NULL,
    creado_en      timestamptz NOT NULL,
    publicado_en   timestamptz
);
CREATE INDEX outbox_pendientes ON outbox (creado_en) WHERE publicado_en IS NULL;

-- Inbox: un mensaje repetido no se aplica dos veces
CREATE TABLE mensajes_procesados (
    id           text        PRIMARY KEY,
    procesado_en timestamptz NOT NULL DEFAULT now()
);
