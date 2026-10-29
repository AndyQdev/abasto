-- Modelo de lanzamiento (29/10/2026): la tienda puede pagar al recibir el pedido.
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_metodo_pago_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_metodo_pago_check CHECK (metodo_pago IN ('QR', 'CREDITO', 'CONTRA_ENTREGA'));
