-- 31/10/2026: la dirección que la tienda elige en el mapa de la app viaja con el pedido.
-- Opcional: los pedidos del e-commerce, de n8n y los de antes no la tienen.
ALTER TABLE pedidos
    ADD COLUMN entrega_calle      VARCHAR(200),
    ADD COLUMN entrega_zona       VARCHAR(200),
    ADD COLUMN entrega_referencia VARCHAR(300),
    ADD COLUMN entrega_latitud    DOUBLE PRECISION,
    ADD COLUMN entrega_longitud   DOUBLE PRECISION;
