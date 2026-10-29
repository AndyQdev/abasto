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

/**
 * Tipos a los que se puede convertir un valor (::tipo o CAST). Los tipos del sistema como regclass u oid
 * no leen datos, pero dejan averiguar qué tablas y funciones existen en la base: se rechazan.
 */
const TIPOS_PERMITIDOS = new Set([
  'TEXT', 'VARCHAR', 'CHAR', 'CHARACTER VARYING',
  'INT', 'INTEGER', 'SMALLINT', 'BIGINT', 'NUMERIC', 'DECIMAL', 'REAL', 'FLOAT', 'DOUBLE PRECISION',
  'DATE', 'TIMESTAMP', 'TIMESTAMPTZ', 'INTERVAL', 'BOOLEAN', 'BOOL',
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

  // Los nombres que la consulta define con WITH se pueden leer, pero solo sin esquema: «public.x» es la tabla real x
  const definidasConWith = new Set(
    ((select.with as Array<{ name?: { value?: string } }> | null) ?? []).map((w) => w.name?.value).filter(Boolean),
  );
  for (const entrada of parser.tableList(limpia, DIALECTO)) {
    const [operacion, esquema, tabla] = entrada.split('::');
    if (operacion !== 'select') return rechazo('Solo se permiten consultas SELECT');
    const esDelWith = esquema === 'null' && definidasConWith.has(tabla);
    if (!esDelWith && !TABLAS_PERMITIDAS.has(tabla)) return rechazo(`La tabla ${tabla} no está disponible para reportes`);
  }

  for (const funcion of funcionesUsadas(select)) {
    if (!FUNCIONES_PERMITIDAS.has(funcion)) return rechazo(`La función ${funcion} no está permitida`);
  }

  for (const tipo of tiposConvertidos(select)) {
    if (!TIPOS_PERMITIDOS.has(tipo)) return rechazo(`La conversión a ${tipo.toLowerCase()} no está permitida`);
  }

  return { ok: true, sql: limpia };
}

/** Junta los tipos de cada conversión (::tipo o CAST(... AS tipo)), en mayúsculas. */
function tiposConvertidos(nodo: unknown, encontrados = new Set<string>()): Set<string> {
  if (Array.isArray(nodo)) {
    for (const hijo of nodo) tiposConvertidos(hijo, encontrados);
    return encontrados;
  }
  if (!nodo || typeof nodo !== 'object') return encontrados;
  const n = nodo as Record<string, unknown>;
  if (n.type === 'cast') {
    for (const destino of [n.target].flat() as Array<{ dataType?: string } | undefined>) {
      if (destino?.dataType) encontrados.add(destino.dataType.toUpperCase());
    }
  }
  for (const valor of Object.values(n)) tiposConvertidos(valor, encontrados);
  return encontrados;
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
