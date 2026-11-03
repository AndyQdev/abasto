// Datos de demostración: las mismas tiendas y mayoristas que usan las maquetas y Keycloak.
// Se corre con `pnpm --filter @abasto/cobros exec prisma db seed`.
import pg from 'pg';

const cliente = new pg.Client({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://cobros:cobros@localhost:5440/cobros',
});
await cliente.connect();

const lineas = [
  // tienda, mayorista, límite en centavos, plazo
  ['dr', 'lp', 400000, 15],
  ['dr', 'lr', 250000, 30],
  ['lp', 'lr', 2000000, 30], // Los Pozos también le compra a La Ramada
];

for (const [tienda, mayorista, limite, plazo] of lineas) {
  await cliente.query(
    `INSERT INTO lineas_de_credito (id, tienda_id, mayorista_id, limite_centavos, plazo_dias)
     VALUES (gen_random_uuid(), $1, $2, $3, $4)
     ON CONFLICT (tienda_id, mayorista_id) DO NOTHING`,
    [tienda, mayorista, limite, plazo],
  );
}

// CU-09: cuentas por cobrar de demostración (pedidos de antes, a crédito y contra entrega), con fechas relativas a hoy
// la primera vez. Sirven para que Cuentas no esté vacía en la demo; las de verdad las abre pedido.confirmado.
const DIA = 86_400_000;
const hoy = Date.now();
const cuentas = [
  // mayorista, tienda, código, origen, centavos, días desde que se confirmó, plazo (null = contra entrega), pagado
  ['lp', 'dr', 'A-0998', 'CREDITO', 185000, 20, 15, 50000],
  ['lp', 'sj', 'A-1019', 'CREDITO', 96000, 14, 15, 0],
  ['lp', 'ec', 'A-1012', 'CREDITO', 240000, 10, 15, 0],
  ['lp', 'es', 'A-1027', 'CREDITO', 132000, 33, 30, 0],
  ['lp', 'dl', 'A-1031', 'CONTRA_ENTREGA', 57500, 1, null, 0],
  ['abasto', 'dr', 'A-0907', 'CONTRA_ENTREGA', 32000, 1, null, 0],
];
for (const [mayorista, tienda, codigo, origen, centavos, hace, plazo, pagado] of cuentas) {
  const abierta = new Date(hoy - hace * DIA);
  const id = `demo-cxc-${mayorista}-${codigo}`;
  const { rowCount } = await cliente.query(
    `INSERT INTO cuentas_por_cobrar (id, pedido_id, codigo, tienda_id, mayorista_id, origen, centavos, abierta_en, vence_en, pagado_centavos)
     VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (pedido_id) DO NOTHING`,
    [id, codigo, tienda, mayorista, origen, centavos, abierta, plazo ? new Date(abierta.getTime() + plazo * DIA) : null, pagado],
  );
  if (rowCount && pagado) {
    await cliente.query(
      `INSERT INTO pagos_de_cuenta (id, cuenta_id, centavos, forma, nota, registrado_en, registrado_por)
       VALUES ($1, $2, $3, 'EFECTIVO', 'Adelanto', $4, 'semilla') ON CONFLICT (id) DO NOTHING`,
      [`${id}-pago-1`, id, pagado, new Date(abierta.getTime() + 3 * DIA)],
    );
  }
}

await cliente.end();
console.log(`Cobros: ${lineas.length} líneas de crédito y ${cuentas.length} cuentas por cobrar de demostración listas`);
