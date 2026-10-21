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
