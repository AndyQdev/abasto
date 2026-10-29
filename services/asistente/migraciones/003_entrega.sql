-- La entrega del pedido (avanzarEntrega en Pedidos) y el pago contra entrega.
-- estado: ... → CONFIRMADO → EN_PREPARACION → DESPACHADO → ENTREGADO.

ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_check CHECK (estado IN (
    'PENDIENTE', 'POR_CONFIRMAR', 'CONFIRMADO', 'RECHAZADO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO'));

ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_metodo_pago_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_metodo_pago_check CHECK (metodo_pago IN ('qr', 'credito', 'contra_entrega'));
