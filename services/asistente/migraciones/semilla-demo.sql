-- Datos de demostración, iguales a los de las maquetas. Fechas relativas a hoy para que
-- "¿qué tiendas me tienen que pagar mañana?" siempre tenga respuesta.
-- Se corre con `pnpm --filter @abasto/asistente semilla`. En el flujo real, esto lo llena el proyector.

INSERT INTO cuentas_por_cobrar (org_id, pedido_id, tienda_id, tienda_nombre, saldo_centavos, vence, estado) VALUES
    ('lp', 'A-1031', 'dr', 'Tienda Doña Rosa',       120000, current_date + 1, 'pendiente'),
    ('lp', 'A-1033', 'ec', 'Minimarket El Cruce',     85000, current_date + 1, 'pendiente'),
    ('lp', 'A-1035', 'sj', 'Tienda San Juan',         42000, current_date + 1, 'pendiente'),
    ('lp', 'A-1036', 'ec', 'Minimarket El Cruce',     48000, current_date + 8, 'pendiente'),
    ('lp', 'A-1020', 'es', 'Tienda La Esquina',       75600, current_date - 3, 'vencida'),
    ('lr', 'R-2001', 'lp', 'Distribuidora Los Pozos', 950000, current_date + 1, 'pendiente')
-- Si la semilla se corrió otro día, se corren las fechas para que sigan siendo relativas a hoy
ON CONFLICT (org_id, pedido_id) DO UPDATE SET vence = EXCLUDED.vence, estado = EXCLUDED.estado, saldo_centavos = EXCLUDED.saldo_centavos;

INSERT INTO stock_productos (org_id, producto_id, nombre, stock, vendidas_por_dia) VALUES
    ('lp', 'HP-0400', 'Shampoo 400 ml',            312, 42),
    ('lp', 'HP-0410', 'Acondicionador 400 ml',    1056, 31),
    ('lp', 'HJ-0110', 'Jabón de tocador 110 g',    288, 25),
    ('lp', 'HB-0090', 'Pasta dental 90 g',        2880, 60),
    ('lp', 'HD-0050', 'Desodorante roll-on 50 ml',   0, 12),
    ('lp', 'LP-0004', 'Papel higiénico 4 rollos', 1320, 40)
ON CONFLICT DO NOTHING;

INSERT INTO ventas_diarias (org_id, fecha, pedidos, total_centavos)
SELECT 'lp', d::date, 3 + (extract(day FROM d)::int % 5), (180000 + (extract(day FROM d)::int % 7) * 45000)
  FROM generate_series(date_trunc('month', current_date), current_date, interval '1 day') AS d
ON CONFLICT DO NOTHING;

-- Los dos meses anteriores, un poco más flojos, para «¿cuánto vendí el mes pasado?» y las comparaciones
INSERT INTO ventas_diarias (org_id, fecha, pedidos, total_centavos)
SELECT 'lp', d::date, 2 + (extract(day FROM d)::int % 4), (150000 + (extract(day FROM d)::int % 6) * 40000)
  FROM generate_series(date_trunc('month', current_date) - interval '2 months',
                       date_trunc('month', current_date) - interval '1 day', interval '1 day') AS d
ON CONFLICT DO NOTHING;

-- Pedidos de demostración para «Tiendas nuevas y las que dejaron de comprar» y «Cómo te pagan»:
-- Doña Rosa y Despensa Lupita son nuevas; San Juan y Almacén Mery no compran hace más de 30 días.
INSERT INTO pedidos (org_id, pedido_id, codigo, tienda_id, tienda_nombre, metodo_pago, total_centavos, estado, creado_en, actualizado_en) VALUES
    ('lp', 'demo-1', 'A-0901', 'sj', 'Tienda San Juan',     'credito',        210000, 'ENTREGADO',  current_date - 70, current_date - 69),
    ('lp', 'demo-2', 'A-0915', 'am', 'Almacén Mery',        'qr',              98000, 'ENTREGADO',  current_date - 52, current_date - 51),
    ('lp', 'demo-3', 'A-0920', 'ec', 'Minimarket El Cruce', 'credito',        185000, 'ENTREGADO',  current_date - 60, current_date - 59),
    ('lp', 'demo-4', 'A-1036', 'ec', 'Minimarket El Cruce', 'credito',         48000, 'CONFIRMADO', current_date - 7,  current_date - 7),
    ('lp', 'demo-5', 'A-1040', 'dr', 'Tienda Doña Rosa',    'credito',        120000, 'ENTREGADO',  current_date - 14, current_date - 13),
    ('lp', 'demo-6', 'A-1044', 'dl', 'Despensa Lupita',     'qr',              64000, 'ENTREGADO',  current_date - 9,  current_date - 8),
    ('lp', 'demo-7', 'A-1047', 'dl', 'Despensa Lupita',     'contra_entrega',  57000, 'DESPACHADO', current_date - 2,  current_date - 1),
    ('lp', 'demo-8', 'A-1049', 'es', 'Tienda La Esquina',   'qr',              43000, 'ENTREGADO',  current_date - 20, current_date - 19),
    ('lp', 'demo-9',  'A-1050', 'dr', 'Tienda Doña Rosa',    'qr',              76000, 'ENTREGADO',      current_date - 1, current_date),
    ('lp', 'demo-10', 'A-1051', 'ec', 'Minimarket El Cruce', 'qr',              92000, 'EN_PREPARACION', current_date - 1, current_date),
    ('lp', 'demo-11', 'A-1052', 'dl', 'Despensa Lupita',     'credito',         54000, 'POR_CONFIRMAR',  current_date,     current_date),
    ('lp', 'demo-12', 'A-1053', 'sj', 'Tienda San Juan',     'qr',              38000, 'POR_CONFIRMAR',  current_date,     current_date),
    ('lp', 'demo-13', 'A-1054', 'es', 'Tienda La Esquina',   'credito',         66000, 'RECHAZADO',      current_date - 4, current_date - 4),
    ('lp', 'demo-14', 'A-1055', 'am', 'Almacén Mery',        'contra_entrega',  41000, 'RECHAZADO',      current_date - 6, current_date - 6)
ON CONFLICT (org_id, pedido_id) DO UPDATE SET creado_en = EXCLUDED.creado_en, actualizado_en = EXCLUDED.actualizado_en;

UPDATE pedidos SET motivo_rechazo = 'La tienda tiene una cuenta vencida' WHERE org_id = 'lp' AND pedido_id = 'demo-13';
UPDATE pedidos SET motivo_rechazo = 'Sin stock de Desodorante roll-on 50 ml' WHERE org_id = 'lp' AND pedido_id = 'demo-14';

-- Segmentos de tiendas (K-means) y demanda de las próximas semanas, también del ML nocturno
INSERT INTO segmento_tiendas (org_id, tienda_id, tienda_nombre, segmento, compras_mes, ticket_promedio_centavos) VALUES
    ('lp', 'ec', 'Minimarket El Cruce', 'Compra por caja',          3.0, 116500),
    ('lp', 'sj', 'Tienda San Juan',     'Compra por caja',          1.0, 210000),
    ('lp', 'dr', 'Tienda Doña Rosa',    'Compra seguido y poco',    4.5,  98000),
    ('lp', 'dl', 'Despensa Lupita',     'Compra seguido y poco',    5.0,  58300),
    ('lp', 'es', 'Tienda La Esquina',   'Compra poco y paga tarde', 1.5,  54500),
    ('lp', 'am', 'Almacén Mery',        'Dejó de comprar',          0.5,  98000)
ON CONFLICT DO NOTHING;

INSERT INTO prediccion_demanda (org_id, producto_id, semana, unidades)
SELECT 'lp', s.producto_id, (date_trunc('week', current_date) + n * interval '1 week')::date,
       round(s.vendidas_por_dia * 7 * (1 + 0.05 * n), 2)
  FROM stock_productos s, generate_series(0, 3) AS n
 WHERE s.org_id = 'lp'
ON CONFLICT DO NOTHING;

-- Lo que dejaría el ML nocturno (`uv run abasto-ml-nocturno` lo recalcula con las cuentas reales)
INSERT INTO riesgo_mora (org_id, tienda_id, tienda_nombre, riesgo, saldo_centavos, cuentas_vencidas) VALUES
    ('lp', 'es', 'Tienda La Esquina',       0.7800,  75600, 1),
    ('lp', 'ec', 'Minimarket El Cruce',     0.4100, 133000, 0),
    ('lp', 'dr', 'Tienda Doña Rosa',        0.2200, 120000, 0),
    ('lp', 'sj', 'Tienda San Juan',         0.1200,  42000, 0),
    ('lr', 'lp', 'Distribuidora Los Pozos', 0.3000, 950000, 0)
ON CONFLICT DO NOTHING;
