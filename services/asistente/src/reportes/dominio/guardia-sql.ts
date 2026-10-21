import sqlParser from 'node-sql-parser';
import { TABLAS_PERMITIDAS } from './esquema.js';

const { Parser } = sqlParser;
const parser = new Parser();
const DIALECTO = { database: 'PostgresQL' };

/** Funciones que una consulta de reportes puede usar. Todo lo demás (pg_sleep, set_config, dblink…) se rechaza. */
const FUNCIONES_PERMITIDAS = new Set([
  'count', 'sum', 'avg', 'min', 'max',
  'round', 'floor', 'ceil', 'abs', 'coalesce', 'nullif', 'greatest', 'least',
  'date_trunc', 'date_part', 'extract', 'to_char', 'now', 'current_date', 'age',
  'lower', 'upper', 'trim', 'concat', 'length',
]);

export const LIMITE_DE_FILAS = 1000;

export type ResultadoGuardia = { ok: true; sql: string } | { ok: false; motivo: string };

const rechazo = (motivo: string): ResultadoGuardia => ({ ok: false, motivo });

/**
 * Primera barrera del MCP: solo una sentencia SELECT, solo tablas de reportes, solo funciones de la lista.
 * No es la única: la consulta corre además como mcp_lector, en una transacción de solo lectura,
 * con 5 segundos como máximo y seguridad por fila.
 */
export function validarConsulta(sql: string): ResultadoGuardia {
  const limpia = sql.trim().replace(/;\s*$/, '');
  if (!limpia) return rechazo('La consulta está vacía');
  if (limpia.includes(';')) return rechazo('Solo se permite una sentencia');

  let ast: unknown;
  try {
    ast = parser.astify(limpia, DIALECTO);
  } catch {
    return rechazo('No se pudo leer la consulta');
  }
  const sentencias = (Array.isArray(ast) ? ast : [ast]) as Array<Record<string, unknown>>;
  if (sentencias.length !== 1) return rechazo('Solo se permite una sentencia');
  const [select] = sentencias;
  if (select.type !== 'select') return rechazo('Solo se permiten consultas SELECT');
  if (select.into && (select.into as { expr?: unknown }).expr) return rechazo('SELECT INTO no está permitido');
  if (select.locking_read) return rechazo('No se permiten bloqueos (FOR UPDATE)');

  for (const entrada of parser.tableList(limpia, DIALECTO)) {
    const [operacion, , tabla] = entrada.split('::');
    if (operacion !== 'select') return rechazo('Solo se permiten consultas SELECT');
    if (!TABLAS_PERMITIDAS.has(tabla)) return rechazo(`La tabla ${tabla} no está disponible para reportes`);
  }

  for (const funcion of funcionesUsadas(select)) {
    if (!FUNCIONES_PERMITIDAS.has(funcion)) return rechazo(`La función ${funcion} no está permitida`);
  }

  return { ok: true, sql: limpia };
}

/** Recorre el árbol y junta el nombre de cada función que aparece, en minúsculas. */
function funcionesUsadas(nodo: unknown, encontradas = new Set<string>()): Set<string> {
  if (Array.isArray(nodo)) {
    for (const hijo of nodo) funcionesUsadas(hijo, encontradas);
    return encontradas;
  }
  if (!nodo || typeof nodo !== 'object') return encontradas;
  const n = nodo as Record<string, unknown>;
  if (n.type === 'function' || n.type === 'aggr_func') {
    const nombre = nombreDeFuncion(n.name);
    if (nombre) encontradas.add(nombre.toLowerCase());
  }
  for (const valor of Object.values(n)) funcionesUsadas(valor, encontradas);
  return encontradas;
}

function nombreDeFuncion(nombre: unknown): string | undefined {
  if (typeof nombre === 'string') return nombre;
  const partes = (nombre as { name?: Array<{ value?: string }> } | undefined)?.name;
  return partes?.map((p) => p.value).join('.');
}
