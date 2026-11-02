/**
 * SOLO PARA PRUEBAS (se llama .spec para que la app no lo compile): el catálogo real de Abasto leído de la semilla de
 * Catálogo (SembrarAbasto.php), como lo vería la app. Las pruebas de plantillas y recetas usan los mismos productos,
 * medidas, usos y precios que el servidor.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import type { Presentacion } from '../carrito';
import type { Mayorista, Producto } from '../catalogo';

const LETRAS: Record<string, string> = { S: 'salteneria', P: 'panaderia', H: 'horneados', C: 'pension', R: 'polleria', A: 'puesto', T: 'tienda', M: 'hogar' };
const php = readFileSync(resolve(__dirname, '../../../../services/catalogo/app/Console/Commands/SembrarAbasto.php'), 'utf8');
const ABASTO: Mayorista = { id: 'abasto', nombre: 'Abasto', ciudad: 'Santa Cruz', verificado: true, relacion: 'NINGUNA', deLaCasa: true };
const bs = (c: number) => `Bs ${(c / 100).toFixed(2).replace('.', ',')}`;
const FILA = /^\s*\['(AB-\d+)', '((?:[^'\\]|\\.)*)', '([^']*)', \[(.*?)\], \d+,.*'([SPHCRATM ]+)'\],$/gm;

export const CATALOGO_DE_LA_SEMILLA: Producto[] = [...php.matchAll(FILA)].map((m) => ({
  id: m[1],
  codigo: m[1],
  nombre: m[2].replace(/\\'/g, "'"),
  rubro: m[3],
  descripcion: '',
  stock: 0,
  estado: 'ACTIVO',
  precioVisible: true,
  abastecimiento: 'BAJO_PEDIDO',
  entregaHoras: 24,
  mayorista: ABASTO,
  escalas: [...m[4].matchAll(/Presentacion::(\w+), (\d+), (\d+)\)/g)].map((e) => ({
    presentacion: e[1] as Presentacion,
    cantidad: Number(e[2]),
    precioUnitario: { centavos: Number(e[3]), texto: bs(Number(e[3])) },
  })),
  usos: m[5].trim().split(/\s+/).map((l: string) => LETRAS[l]),
}));

it('lee los 138 productos de la semilla, cada uno con precio y usos', () => {
  expect(CATALOGO_DE_LA_SEMILLA).toHaveLength(138);
  for (const p of CATALOGO_DE_LA_SEMILLA) expect(p.escalas.length && p.usos?.length, p.id).toBeTruthy();
});
