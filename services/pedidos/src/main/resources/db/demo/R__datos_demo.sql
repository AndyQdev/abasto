-- Pedidos de demostración, los mismos que muestra la maqueta del Panel Mayorista.
-- Solo se cargan con el perfil `demo`. Los que están por confirmar tienen su saga esperando al mayorista,
-- así se pueden confirmar o rechazar desde el Panel.

INSERT INTO pedidos (id, codigo, clave, tienda_id, mayorista_id, metodo_pago, estado, motivo_rechazo, creado_en) VALUES
    ('7b0d4f3e-0001-4000-8000-000000001053', 'A-1053', '7b0d4f3e-1001-4000-8000-000000001053', 'dl', 'lp', 'QR',      'POR_CONFIRMAR',  NULL,        now() - interval '20 minutes'),
    ('7b0d4f3e-0001-4000-8000-000000001052', 'A-1052', '7b0d4f3e-1001-4000-8000-000000001052', 'ec', 'lp', 'QR',      'POR_CONFIRMAR',  NULL,        now() - interval '1 hour'),
    ('7b0d4f3e-0001-4000-8000-000000001051', 'A-1051', '7b0d4f3e-1001-4000-8000-000000001051', 'am', 'lp', 'CREDITO', 'POR_CONFIRMAR',  NULL,        now() - interval '90 minutes'),
    ('7b0d4f3e-0001-4000-8000-000000001042', 'A-1042', '7b0d4f3e-1001-4000-8000-000000001042', 'dr', 'lp', 'QR',      'EN_PREPARACION', NULL,        now() - interval '3 hours'),
    ('7b0d4f3e-0001-4000-8000-000000001040', 'A-1040', '7b0d4f3e-1001-4000-8000-000000001040', 'dr', 'lp', 'QR',      'ENTREGADO',      NULL,        now() - interval '5 days'),
    ('7b0d4f3e-0001-4000-8000-000000001038', 'A-1038', '7b0d4f3e-1001-4000-8000-000000001038', 'es', 'lp', 'CREDITO', 'RECHAZADO',      'Sin stock', now() - interval '6 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO lineas_de_pedido (pedido_id, posicion, producto_id, presentacion, cantidad, unidades, precio_unitario_centavos) VALUES
    ('7b0d4f3e-0001-4000-8000-000000001053', 0, 'HD-0050', 'CAJA',   3, 108, 1300),
    ('7b0d4f3e-0001-4000-8000-000000001052', 0, 'HB-0090', 'DOCENA', 5,  60,  650),
    ('7b0d4f3e-0001-4000-8000-000000001051', 0, 'LP-0004', 'CAJA',   1,  24, 1000),
    ('7b0d4f3e-0001-4000-8000-000000001042', 0, 'HP-0400', 'CAJA',   2,  96, 1800),
    ('7b0d4f3e-0001-4000-8000-000000001040', 0, 'HB-0090', 'DOCENA', 5,  60,  650),
    ('7b0d4f3e-0001-4000-8000-000000001038', 0, 'HD-0050', 'CAJA',   1,  36, 1300)
ON CONFLICT DO NOTHING;

INSERT INTO sagas_de_compra (pedido_id, paso, stock_reservado, cobrado, vence_confirmacion_en) VALUES
    ('7b0d4f3e-0001-4000-8000-000000001053', 'ESPERANDO_MAYORISTA', true, true, now() + interval '2 hours'),
    ('7b0d4f3e-0001-4000-8000-000000001052', 'ESPERANDO_MAYORISTA', true, true, now() + interval '2 hours'),
    ('7b0d4f3e-0001-4000-8000-000000001051', 'ESPERANDO_MAYORISTA', true, true, now() + interval '2 hours'),
    ('7b0d4f3e-0001-4000-8000-000000001042', 'COMPLETADA',          true, true, NULL),
    ('7b0d4f3e-0001-4000-8000-000000001040', 'COMPLETADA',          true, true, NULL),
    ('7b0d4f3e-0001-4000-8000-000000001038', 'COMPENSADA',          false, false, NULL)
ON CONFLICT (pedido_id) DO NOTHING;
