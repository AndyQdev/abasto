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

await cliente.end();
console.log(`Cobros: ${lineas.length} líneas de crédito listas`);
