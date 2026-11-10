#!/usr/bin/env node
/**
 * Carga masiva de datos históricos (10/11): unos 2.400 pedidos de los últimos 6 meses, para probar los reportes
 * con volumen de verdad (lo pidió el ingeniero: «una gran cantidad de datos para ver cómo genera los reportes»).
 *
 * Qué carga, todo coherente entre sí:
 * - Catálogo (Mongo): 60 tiendas nuevas en 6 ciudades, con su tipo de negocio, y su relación aprobada con los
 *   mayoristas de la red privada.
 * - Pedidos (Postgres `pedidos`): los pedidos con sus líneas (productos y precios reales del catálogo), la saga
 *   terminada y algunos reclamos. Así el Panel (Pedidos, Clientes) y el Superadmin (Tracción, Reportes, Reclamos)
 *   también muestran el volumen.
 * - Reportes (Postgres `reportes`, lo que lee el Analista): pedidos, ventas del día, ventas por producto, cuentas
 *   por cobrar, stock con lo vendido por día, segmentos de tiendas, demanda de las próximas semanas y riesgo de mora.
 *
 * Cómo se comportan las tiendas: unas compran seguido y poco, otras por caja; algunas pagan tarde, otras dejaron de
 * comprar y otras son nuevas. Las ventas crecen mes a mes, bajan el domingo, suben a fin de mes y en fechas como
 * el 6 de agosto, el 24 de septiembre y Todos Santos (harina, azúcar y manteca para las t'antawawas).
 *
 * Es determinista (semilla fija) y se puede repetir: borra lo que cargó antes (pedidos con id `cafe…`, tiendas con
 * `cargaMasiva: true`) y vuelve a cargar. No toca los pedidos reales ni los de las pruebas.
 *
 * Correr (con `pnpm todo` arriba y el Asistente al día, que crea la tabla `ventas_por_producto`):
 *   node scripts/carga-masiva.mjs                  carga en el Docker local
 *   node scripts/carga-masiva.mjs --solo-archivos  solo deja los archivos en .carga-masiva/ (para la nube)
 *   --meses 6 · --pedidos 2400 · --semilla 7
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const salida = join(raiz, '.carga-masiva');
const argumento = (nombre, porDefecto) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? Number(process.argv[i + 1]) : porDefecto;
};
const SOLO_ARCHIVOS = process.argv.includes('--solo-archivos');
const MESES = argumento('meses', 6);
const TOTAL_PEDIDOS = argumento('pedidos', 2400);
const SEMILLA = argumento('semilla', 7);

// ── Azar repetible ──────────────────────────────────────────────────────────────────────────────────────────────
let estadoAzar = SEMILLA >>> 0;
function azar() {
  estadoAzar = (estadoAzar + 0x6d2b79f5) >>> 0;
  let t = estadoAzar;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (a, b) => a + Math.floor(azar() * (b - a + 1));
const elegir = (lista) => lista[Math.floor(azar() * lista.length)];
function elegirConPeso(lista, peso) {
  const total = lista.reduce((s, x) => s + peso(x), 0);
  let r = azar() * total;
  for (const x of lista) {
    r -= peso(x);
    if (r <= 0) return x;
  }
  return lista.at(-1);
}
function poisson(media) {
  const l = Math.exp(-media);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= azar();
  } while (p > l);
  return k - 1;
}
let contadorUuid = 0;
/** uuid que empieza con `cafe`: así se reconoce (y se borra) lo que cargó este script */
function uuid() {
  contadorUuid++;
  const hex = (n, largo) => n.toString(16).padStart(largo, '0').slice(-largo);
  return `cafe${hex(contadorUuid, 4)}-${hex(Math.floor(azar() * 0xffff), 4)}-4${hex(Math.floor(azar() * 0xfff), 3)}-8${hex(Math.floor(azar() * 0xfff), 3)}-${hex(Math.floor(azar() * 0xffffff), 6)}${hex(contadorUuid, 6)}`;
}

// ── Fechas (hora de Bolivia, UTC−4, sin horario de verano) ──────────────────────────────────────────────────────
const DIA_MS = 86_400_000;
const hoyBolivia = new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10);
const HOY = new Date(`${hoyBolivia}T00:00:00Z`);
const DESDE = new Date(Date.UTC(HOY.getUTCFullYear(), HOY.getUTCMonth() - MESES, 1));
const dia = (d) => d.toISOString().slice(0, 10);
const masDias = (d, n) => new Date(d.getTime() + n * DIA_MS);
const diasEntre = (a, b) => Math.round((b.getTime() - a.getTime()) / DIA_MS);
/** '2026-08-12T09:31:00-04:00' */
function momento(fecha, minutos) {
  const h = String(Math.floor(minutos / 60)).padStart(2, '0');
  const m = String(minutos % 60).padStart(2, '0');
  return `${dia(fecha)}T${h}:${m}:00-04:00`;
}

// ── Catálogo: los productos reales de cada mayorista ────────────────────────────────────────────────────────────
const MAYORISTAS = {
  lp: { nombre: 'Distribuidora Los Pozos', parte: 0.5, redPrivada: true },
  abasto: { nombre: 'Abasto', parte: 0.42, redPrivada: false },
  lr: { nombre: 'Importadora La Ramada', parte: 0.08, redPrivada: true },
};

function docker(servicio, comando, entrada) {
  const r = spawnSync('docker', ['compose', 'exec', '-T', servicio, ...comando], {
    cwd: raiz,
    input: entrada,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`${servicio}: ${r.stderr || r.stdout}`);
  return r.stdout;
}

const consultaProductos = `const d = db.getSiblingDB('catalogo');
print('JSON' + JSON.stringify(d.productos.find(
  { mayorista_id: { $in: ${JSON.stringify(Object.keys(MAYORISTAS))} }, estado: { $in: ['ACTIVO', 'SIN_STOCK'] }, 'escalas.0': { $exists: true } },
  { mayorista_id: 1, nombre: 1, rubro: 1, stock: 1, escalas: 1 }).toArray()));`;
const lineaJson = docker('mongo', ['mongosh', '--quiet', '--eval', consultaProductos])
  .split('\n')
  .find((l) => l.startsWith('JSON'));
const productos = JSON.parse(lineaJson.slice(4))
  .map((p) => ({ ...p, escalas: p.escalas.filter((e) => e.precio_unitario_centavos > 0 && e.unidades > 0) }))
  .filter((p) => p.escalas.length);
const productosDe = Object.fromEntries(Object.keys(MAYORISTAS).map((m) => [m, productos.filter((p) => p.mayorista_id === m)]));
for (const [m, lista] of Object.entries(productosDe)) {
  if (!lista.length) {
    console.warn(`${m} no tiene productos activos en Catálogo: no se le cargan pedidos`);
    delete MAYORISTAS[m];
    continue;
  }
  // Popularidad fija por producto (unos pocos se llevan la mayor parte, como en la vida real)
  lista.forEach((p) => (p.popularidad = Math.pow(azar(), 2.2) * 10 + 0.3));
}

// ── Tiendas ─────────────────────────────────────────────────────────────────────────────────────────────────────
const NOMBRES_DE_TIENDAS = [
  'Tienda Don Pepe', 'Abarrotes Doña Juana', 'Minimarket Los Mangales', 'Tienda El Trompillo', 'Despensa Santa Rita',
  'Abarrotes La Ramada Chica', 'Tienda Mi Bendición', 'Minimarket Plan 3000', 'Tienda Doña Ely', 'Almacén El Carmen',
  'Abarrotes Villa 1ro de Mayo', 'Tienda La Económica', 'Minimarket Equipetrol', 'Tienda Don Lucho', 'Despensa La Familia',
  'Salteñería La Cueva', 'Panadería San Antonio', 'Pensión Doña Martha', 'Pollería El Rico Pollo', 'Panadería La Espiga',
  'Tienda Los Pinos', 'Abarrotes San Silvestre', 'Minimarket El Bajío', 'Tienda Doña Cata', 'Almacén Hermanos Vaca',
  'Tienda El Paraíso', 'Despensa Don Beto', 'Minimarket La Pampa', 'Abarrotes Mercado Mutualista', 'Tienda La Bendita',
  'Salteñería Doña Fina', 'Panadería El Horno de Barro', 'Tienda Villa Fátima', 'Abarrotes Miraflores', 'Minimarket Sopocachi',
  'Tienda El Alto Norte', 'Despensa Calacoto', 'Abarrotes La Cancha', 'Tienda Quillacollo', 'Minimarket Sacaba',
  'Pensión El Buen Sabor', 'Tienda Tiquipaya', 'Abarrotes Sucre Centro', 'Tienda La Recoleta', 'Despensa Charcas',
  'Minimarket Tarija Centro', 'Tienda San Roque', 'Abarrotes El Molino', 'Tienda Montero Norte', 'Almacén Don Ramiro',
  'Tienda Doña Felipa', 'Minimarket Warnes', 'Panadería Montero', 'Tienda La Guardia', 'Abarrotes Cotoca',
  'Despensa Don Willy', 'Tienda Las Palmas', 'Minimarket Urubó', 'Tienda Pampa de la Isla', 'Abarrotes Satélite Norte',
];
function ciudadDe(nombre) {
  if (/Villa Fátima|Miraflores|Sopocachi|El Alto|Calacoto/.test(nombre)) return 'La Paz';
  if (/La Cancha|Quillacollo|Sacaba|Tiquipaya|Buen Sabor/.test(nombre)) return 'Cochabamba';
  if (/Sucre|Recoleta|Charcas/.test(nombre)) return 'Sucre';
  if (/Tarija|San Roque|El Molino/.test(nombre)) return 'Tarija';
  if (/Montero|Warnes/.test(nombre)) return 'Montero';
  return 'Santa Cruz';
}
const slug = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/**
 * Cómo compra cada tipo: pedidos por mes, cuántas líneas, qué presentación prefiere (0 = la más chica) y cuántas.
 */
const PERFILES = {
  barrio: { porMes: 3.5, lineas: [1, 4], escala: 0.3, cantidad: [1, 3] },
  minimarket: { porMes: 7, lineas: [3, 7], escala: 0.6, cantidad: [1, 4] },
  porCaja: { porMes: 2, lineas: [2, 5], escala: 1, cantidad: [2, 6] },
  productor: { porMes: 6, lineas: [2, 4], escala: 0.8, cantidad: [1, 5] },
};

const tiendas = NOMBRES_DE_TIENDAS.map((nombre) => {
  const productor = /Salteñería|Panadería|Pensión|Pollería/.test(nombre);
  const perfil = productor ? 'productor' : elegirConPeso(['barrio', 'minimarket', 'porCaja'], (x) => ({ barrio: 6, minimarket: 3, porCaja: 1.2 })[x]);
  const nueva = azar() < 0.18;
  const seVa = !nueva && azar() < 0.12;
  return {
    id: `cm-${slug(nombre)}`,
    nombre,
    ciudad: ciudadDe(nombre),
    perfil,
    negocio: productor
      ? { tipo: 'productor', subtipo: /Salteñería/.test(nombre) ? 'salteneria' : /Panadería/.test(nombre) ? 'panaderia' : /Pollería/.test(nombre) ? 'polleria' : 'pension' }
      : { tipo: 'tienda', subtipo: null },
    // Desde cuándo y hasta cuándo compra (las nuevas empiezan en los últimos 2 meses; algunas dejaron de comprar)
    alta: nueva ? masDias(HOY, -entre(5, 60)) : masDias(DESDE, entre(0, 25)),
    baja: seVa ? masDias(HOY, -entre(35, 100)) : null,
    pagaTarde: azar() < 0.15,
    // Cómo prefiere pagar
    metodos: elegir([
      { qr: 6, credito: 2, contra_entrega: 2 },
      { qr: 2, credito: 6, contra_entrega: 2 },
      { qr: 3, credito: 3, contra_entrega: 4 },
      { qr: 5, credito: 1, contra_entrega: 4 },
    ]),
    // A quién le compra: casi todas a Abasto; varias a Los Pozos; pocas a La Ramada
    mayoristas: ['abasto', ...(azar() < 0.6 ? ['lp'] : []), ...(azar() < 0.18 ? ['lr'] : [])].filter((m) => MAYORISTAS[m]),
    ganas: 0.6 + azar() * 0.9,
    calle: `${elegir(['Av. Banzer', 'Av. Grigotá', 'Calle Sucre', 'Av. Alemana', 'Calle Junín', 'Av. Busch', 'Av. Virgen de Cotoca', 'Calle Ayacucho'])} ${entre(100, 2400)}`,
  };
});
// Las 6 tiendas de la semilla también compran (con su historia: San Juan y Almacén Mery dejaron de comprar)
const DE_LA_SEMILLA = [
  ['dr', 'Tienda Doña Rosa', 'barrio', null],
  ['ec', 'Minimarket El Cruce', 'minimarket', null],
  ['dl', 'Despensa Lupita', 'barrio', null],
  ['es', 'Tienda La Esquina', 'barrio', null],
  ['sj', 'Tienda San Juan', 'porCaja', 38],
  ['am', 'Almacén Mery', 'barrio', 45],
];
for (const [id, nombre, perfil, sinComprarHace] of DE_LA_SEMILLA) {
  tiendas.push({
    id, nombre, ciudad: 'Santa Cruz', perfil, deLaSemilla: true,
    alta: masDias(DESDE, entre(0, 20)),
    baja: sinComprarHace ? masDias(HOY, -sinComprarHace) : null,
    pagaTarde: id === 'es',
    metodos: { qr: 3, credito: 4, contra_entrega: 2 },
    mayoristas: ['abasto', 'lp'],
    ganas: 1,
    calle: 'Av. Santos Dumont 3100',
  });
}

// ── Pedidos ─────────────────────────────────────────────────────────────────────────────────────────────────────
const MOTIVOS_DE_RECHAZO = [
  'Sin stock de lo que pidió',
  'La tienda tiene una cuenta vencida',
  'No llegamos a esa zona ese día',
  'Pasó su línea de crédito',
  'La tienda pidió cancelarlo',
  'Precio por confirmar: el proveedor subió el precio',
];

/** Cuánto se vende ese día comparado con un día normal */
function ritmo(fecha) {
  const t = diasEntre(DESDE, fecha) / Math.max(1, diasEntre(DESDE, HOY));
  const semana = [0.35, 1.25, 1, 1, 1.05, 1.3, 0.9][fecha.getUTCDay()]; // domingo flojo; lunes y viernes fuertes
  const finDeMes = fecha.getUTCDate() >= 27 ? 1.18 : 1;
  const md = dia(fecha).slice(5);
  const fiesta = md >= '08-01' && md <= '08-06' ? 1.3 : md >= '09-20' && md <= '09-24' ? 1.2 : md >= '10-24' && md <= '11-02' ? 1.35 : 1;
  return (0.7 + 0.6 * t) * semana * finDeMes * fiesta;
}

function lineasDelPedido(tienda, mayorista, fecha) {
  const perfil = PERFILES[tienda.perfil];
  const md = dia(fecha).slice(5);
  const todosSantos = md >= '10-20' && md <= '11-02';
  const lista = productosDe[mayorista];
  const elegidos = new Set();
  const cuantas = Math.min(lista.length, entre(...perfil.lineas));
  while (elegidos.size < cuantas) {
    elegidos.add(
      elegirConPeso(lista, (p) => {
        let peso = p.popularidad;
        if (todosSantos && /Harina|panific/i.test(`${p.rubro} ${p.nombre}`)) peso *= 4;
        if (todosSantos && /Azúcar|Manteca|Aceite/i.test(p.nombre)) peso *= 2.5;
        if (tienda.perfil === 'productor' && /Harina|Aceite|Azúcar|Condimento|Huevo/i.test(`${p.rubro} ${p.nombre}`)) peso *= 2;
        return peso;
      }),
    );
  }
  return [...elegidos].map((p, i) => {
    const escalas = [...p.escalas].sort((a, b) => a.unidades - b.unidades);
    // El perfil decide qué presentación suele pedir (los «por caja» se van a la más grande)
    const indice = Math.min(escalas.length - 1, Math.round((escalas.length - 1) * Math.min(1, perfil.escala * (0.5 + azar()))));
    const escala = escalas[indice];
    const cantidad = entre(...perfil.cantidad);
    const unidades = cantidad * escala.unidades;
    return {
      posicion: i,
      productoId: p._id,
      nombre: p.nombre,
      presentacion: escala.presentacion,
      cantidad,
      unidades,
      precio: escala.precio_unitario_centavos,
      subtotal: unidades * escala.precio_unitario_centavos,
    };
  });
}

/** En qué quedó el pedido según cuántos días tiene (los viejos ya se entregaron) */
function estadoSegunEdad(edad) {
  if (azar() < 0.06 && edad >= 0) return 'RECHAZADO';
  if (edad >= 3) return 'ENTREGADO';
  if (edad === 2) return azar() < 0.7 ? 'ENTREGADO' : 'DESPACHADO';
  if (edad === 1) return elegirConPeso(['ENTREGADO', 'DESPACHADO', 'EN_PREPARACION'], (x) => ({ ENTREGADO: 3, DESPACHADO: 4, EN_PREPARACION: 3 })[x]);
  return azar() < 0.5 ? 'CONFIRMADO' : 'EN_PREPARACION';
}

const pedidos = [];
let siguienteCodigo = 2000;
const diasTotales = diasEntre(DESDE, HOY) + 1;
const sumaDeRitmos = Array.from({ length: diasTotales }, (_, i) => ritmo(masDias(DESDE, i))).reduce((a, b) => a + b, 0);
for (let i = 0; i < diasTotales; i++) {
  const fecha = masDias(DESDE, i);
  for (const [mayorista, m] of Object.entries(MAYORISTAS)) {
    const esperado = (TOTAL_PEDIDOS * m.parte * ritmo(fecha)) / sumaDeRitmos;
    const activas = tiendas.filter((t) => t.mayoristas.includes(mayorista) && t.alta <= fecha && (!t.baja || fecha < t.baja));
    if (!activas.length) continue;
    const n = poisson(esperado);
    for (let k = 0; k < n; k++) {
      const tienda = elegirConPeso(activas, (t) => PERFILES[t.perfil].porMes * t.ganas);
      const lineas = lineasDelPedido(tienda, mayorista, fecha);
      const edad = diasEntre(fecha, HOY);
      const estado = estadoSegunEdad(edad);
      const minutos = entre(7 * 60, 20 * 60);
      const metodo = elegirConPeso(Object.keys(tienda.metodos), (x) => tienda.metodos[x]);
      const total = lineas.reduce((s, l) => s + l.subtotal, 0);
      // Cuándo cambió por última vez: entregado al día siguiente (o el mismo si es temprano), rechazado en minutos
      const horasHastaElFin = estado === 'RECHAZADO' ? 0.4 : estado === 'ENTREGADO' ? entre(18, 40) : entre(1, 6);
      const fin = new Date(new Date(momento(fecha, minutos)).getTime() + horasHastaElFin * 3600_000);
      pedidos.push({
        id: uuid(),
        clave: uuid(),
        codigo: `A-${siguienteCodigo++}`,
        tienda,
        mayorista,
        metodo,
        estado,
        motivo: estado === 'RECHAZADO' ? elegirConPeso(MOTIVOS_DE_RECHAZO, (x) => (x.includes('stock') ? 3 : 1)) : null,
        creadoEn: momento(fecha, minutos),
        actualizadoEn: fin > new Date() ? new Date().toISOString() : fin.toISOString(),
        fecha,
        lineas,
        total,
      });
    }
  }
}

// ── Cuentas por cobrar (los pedidos a crédito) ──────────────────────────────────────────────────────────────────
const PLAZO_DIAS = 15;
const cuentas = pedidos
  .filter((p) => p.metodo === 'credito' && p.estado !== 'RECHAZADO')
  .map((p) => {
    const vence = masDias(p.fecha, PLAZO_DIAS);
    let estado = 'pagada';
    let saldo = 0;
    if (vence >= HOY) {
      estado = 'pendiente';
      saldo = azar() < 0.2 ? Math.round(p.total * 0.5) : p.total; // algunas ya pagaron la mitad
    } else if (p.tienda.pagaTarde ? azar() < 0.45 : azar() < 0.03) {
      estado = 'vencida';
      saldo = azar() < 0.3 ? Math.round(p.total * 0.4) : p.total;
    }
    return { pedido: p, vence, estado, saldo };
  });

// ── Reclamos (pocos, sobre pedidos entregados) ──────────────────────────────────────────────────────────────────
const MOTIVOS_DE_RECLAMO = {
  INCOMPLETO: 'Faltó una docena de lo que pedí',
  DANADO: 'Llegaron dos bolsas rotas',
  COBRO_EQUIVOCADO: 'Me cobraron de más en el QR',
  NO_LLEGO: 'El pedido no llegó en la fecha',
  OTRO: 'El producto no era la marca que pedí',
};
const reclamos = pedidos
  .filter((p) => p.estado === 'ENTREGADO' && azar() < 0.012)
  .map((p) => {
    const motivo = elegir(Object.keys(MOTIVOS_DE_RECLAMO));
    const abierto = diasEntre(p.fecha, HOY) < 6 && azar() < 0.6;
    const aprobado = !abierto && azar() < 0.75;
    return {
      id: uuid(),
      pedido: p,
      motivo,
      detalle: MOTIVOS_DE_RECLAMO[motivo],
      estado: abierto ? 'ABIERTO' : aprobado ? 'APROBADO' : 'RECHAZADO',
      respuesta: abierto ? null : aprobado ? 'Te devolvimos lo que faltó. Disculpa la molestia.' : 'Revisamos la entrega y llegó completa.',
      devuelto: aprobado ? Math.round(p.total * (0.05 + azar() * 0.15)) : null,
      forma: aprobado ? elegir(['EFECTIVO', 'TRANSFERENCIA', 'QR']) : null,
      creadoEn: new Date(new Date(p.actualizadoEn).getTime() + 5 * 3600_000).toISOString(),
      resueltoEn: abierto ? null : new Date(new Date(p.actualizadoEn).getTime() + 30 * 3600_000).toISOString(),
    };
  });

// ── SQL ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const txt = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => (v === null || v === undefined ? 'NULL' : String(v));
function insertar(tabla, columnas, filas, sufijo = '') {
  const partes = [];
  for (let i = 0; i < filas.length; i += 500) {
    partes.push(`INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES\n${filas.slice(i, i + 500).map((f) => `(${f.join(', ')})`).join(',\n')}${sufijo};`);
  }
  return partes.join('\n');
}
const ESTADOS_VENDIDOS = ['CONFIRMADO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO'];
const metodoPedidos = { qr: 'QR', credito: 'CREDITO', contra_entrega: 'CONTRA_ENTREGA' };

const sqlPedidos = `-- Carga masiva (scripts/carga-masiva.mjs). Repetible: borra lo que cargó antes.
BEGIN;
DELETE FROM reclamos WHERE id::text LIKE 'cafe%' OR pedido_id::text LIKE 'cafe%';
DELETE FROM sagas_de_compra WHERE pedido_id::text LIKE 'cafe%';
DELETE FROM pedidos WHERE id::text LIKE 'cafe%';
${insertar(
  'pedidos',
  ['id', 'codigo', 'clave', 'tienda_id', 'mayorista_id', 'metodo_pago', 'estado', 'motivo_rechazo', 'creado_en', 'entrega_calle', 'entrega_zona'],
  pedidos.map((p) => [txt(p.id), txt(p.codigo), txt(p.clave), txt(p.tienda.id), txt(p.mayorista), txt(metodoPedidos[p.metodo]), txt(p.estado), txt(p.motivo), txt(p.creadoEn), txt(p.tienda.calle), txt(p.tienda.ciudad)]),
)}
${insertar(
  'lineas_de_pedido',
  ['pedido_id', 'posicion', 'producto_id', 'presentacion', 'cantidad', 'unidades', 'precio_unitario_centavos'],
  pedidos.flatMap((p) => p.lineas.map((l) => [txt(p.id), num(l.posicion), txt(l.productoId), txt(l.presentacion), num(l.cantidad), num(l.unidades), num(l.precio)])),
)}
${insertar(
  'sagas_de_compra',
  ['pedido_id', 'paso', 'stock_reservado', 'cobrado'],
  pedidos.map((p) => [txt(p.id), txt(p.estado === 'RECHAZADO' ? 'COMPENSADA' : 'COMPLETADA'), p.estado === 'RECHAZADO' ? 'false' : 'true', p.estado === 'RECHAZADO' ? 'false' : 'true']),
)}
${insertar(
  'reclamos',
  ['id', 'pedido_id', 'tienda_id', 'mayorista_id', 'motivo', 'detalle', 'estado', 'respuesta', 'devuelto_centavos', 'forma', 'resuelto_por', 'creado_en', 'resuelto_en'],
  reclamos.map((r) => [txt(r.id), txt(r.pedido.id), txt(r.pedido.tienda.id), txt(r.pedido.mayorista), txt(r.motivo), txt(r.detalle), txt(r.estado), txt(r.respuesta), num(r.devuelto), txt(r.forma), r.estado === 'ABIERTO' ? 'NULL' : txt('admin@abasto.bo'), txt(r.creadoEn), txt(r.resueltoEn)]),
)}
-- Los pedidos nuevos siguen después de los cargados
SELECT setval('pedido_codigo_seq', greatest((SELECT last_value FROM pedido_codigo_seq), ${siguienteCodigo}));
COMMIT;
`;

// Reportes: lo que dejarían el proyector y el ML nocturno con estos pedidos
const orgs = Object.keys(MAYORISTAS).map(txt).join(', ');
const porProducto = new Map();
for (const p of pedidos.filter((x) => ESTADOS_VENDIDOS.includes(x.estado))) {
  for (const l of p.lineas) {
    const k = `${p.mayorista}|${dia(p.fecha)}|${l.productoId}`;
    const v = porProducto.get(k) ?? { org: p.mayorista, fecha: dia(p.fecha), producto: l.productoId, nombre: l.nombre, unidades: 0, total: 0 };
    v.unidades += l.unidades;
    v.total += l.subtotal;
    porProducto.set(k, v);
  }
}

const sqlReportes = `-- Carga masiva (scripts/carga-masiva.mjs). Repetible: borra lo que cargó antes.
BEGIN;
DELETE FROM cuentas_por_cobrar WHERE (org_id, pedido_id) IN (SELECT org_id, codigo FROM pedidos WHERE pedido_id LIKE 'cafe%');
DELETE FROM pedidos WHERE pedido_id LIKE 'cafe%';
${insertar(
  'pedidos',
  ['org_id', 'pedido_id', 'codigo', 'tienda_id', 'tienda_nombre', 'metodo_pago', 'total_centavos', 'estado', 'motivo_rechazo', 'creado_en', 'actualizado_en'],
  pedidos.map((p) => [txt(p.mayorista), txt(p.id), txt(p.codigo), txt(p.tienda.id), txt(p.tienda.nombre), txt(p.metodo), num(p.total), txt(p.estado), txt(p.motivo), txt(p.creadoEn), txt(p.actualizadoEn)]),
)}
${insertar(
  'cuentas_por_cobrar',
  ['org_id', 'pedido_id', 'tienda_id', 'tienda_nombre', 'saldo_centavos', 'vence', 'estado'],
  cuentas.map((c) => [txt(c.pedido.mayorista), txt(c.pedido.codigo), txt(c.pedido.tienda.id), txt(c.pedido.tienda.nombre), num(c.saldo), txt(dia(c.vence)), txt(c.estado)]),
  ' ON CONFLICT (org_id, pedido_id) DO NOTHING',
)}

-- Ventas del día: se rehacen desde los pedidos vendidos (los cargados, los reales y los de la demo)
DELETE FROM ventas_diarias WHERE org_id IN (${orgs}) AND fecha >= ${txt(dia(DESDE))};
INSERT INTO ventas_diarias (org_id, fecha, pedidos, total_centavos)
SELECT org_id, (creado_en AT TIME ZONE 'America/La_Paz')::date, count(*), sum(total_centavos)
  FROM pedidos
 WHERE org_id IN (${orgs}) AND estado IN (${ESTADOS_VENDIDOS.map(txt).join(', ')})
   AND (creado_en AT TIME ZONE 'America/La_Paz')::date >= ${txt(dia(DESDE))}
 GROUP BY 1, 2;

-- Ventas por producto (migración 005 del Asistente)
DELETE FROM ventas_por_producto WHERE org_id IN (${orgs}) AND fecha >= ${txt(dia(DESDE))};
${insertar(
  'ventas_por_producto',
  ['org_id', 'fecha', 'producto_id', 'producto_nombre', 'unidades', 'total_centavos'],
  [...porProducto.values()].map((v) => [txt(v.org), txt(v.fecha), txt(v.producto), txt(v.nombre), num(v.unidades), num(v.total)]),
)}

-- Stock de cada producto con lo vendido por día en los últimos 30 días
${insertar(
  'stock_productos',
  ['org_id', 'producto_id', 'nombre', 'stock'],
  productos.map((p) => [txt(p.mayorista_id), txt(p._id), txt(p.nombre), num(Math.max(0, p.stock ?? 0))]),
  ' ON CONFLICT (org_id, producto_id) DO UPDATE SET nombre = EXCLUDED.nombre, stock = EXCLUDED.stock',
)}
UPDATE stock_productos s
   SET vendidas_por_dia = coalesce((SELECT round(sum(v.unidades) / 30.0, 2) FROM ventas_por_producto v
                                     WHERE v.org_id = s.org_id AND v.producto_id = s.producto_id
                                       AND v.fecha > current_date - 30), 0)
 WHERE s.org_id IN (${orgs});

-- Demanda de las próximas 4 semanas: el promedio de las últimas 8 con la tendencia de las últimas 4
DELETE FROM prediccion_demanda WHERE org_id IN (${orgs});
INSERT INTO prediccion_demanda (org_id, producto_id, semana, unidades)
SELECT b.org_id, b.producto_id, (date_trunc('week', current_date) + n * interval '1 week')::date,
       round(b.por_semana * (1 + b.tendencia * (n + 1)), 2)
  FROM (SELECT org_id, producto_id,
               sum(unidades) FILTER (WHERE fecha > current_date - 56) / 8.0 AS por_semana,
               least(0.08, greatest(-0.08,
                 coalesce((sum(unidades) FILTER (WHERE fecha > current_date - 28) /
                           nullif(sum(unidades) FILTER (WHERE fecha > current_date - 56 AND fecha <= current_date - 28), 0)) - 1, 0) / 4)) AS tendencia
          FROM ventas_por_producto WHERE org_id IN (${orgs}) GROUP BY 1, 2) b,
       generate_series(0, 3) AS n
 WHERE b.por_semana > 0;

-- Segmentos de tiendas (lo que haría K-means con estos pedidos), con nombres que se entienden
DELETE FROM segmento_tiendas WHERE org_id IN (${orgs});
INSERT INTO segmento_tiendas (org_id, tienda_id, tienda_nombre, segmento, compras_mes, ticket_promedio_centavos)
SELECT org_id, tienda_id, tienda_nombre,
       CASE
         WHEN ultima < current_date - 30 THEN 'Dejó de comprar'
         WHEN primera > current_date - 60 THEN 'Tienda nueva'
         WHEN vencidas > 0 THEN 'Compra poco y paga tarde'
         WHEN ticket >= 250000 THEN 'Compra por caja'
         WHEN por_mes >= 5 THEN 'Compra seguido y poco'
         ELSE 'Compra de vez en cuando'
       END,
       round(por_mes, 2), ticket
  FROM (SELECT p.org_id, p.tienda_id, max(p.tienda_nombre) AS tienda_nombre,
               max(p.creado_en)::date AS ultima, min(p.creado_en)::date AS primera,
               count(*) FILTER (WHERE p.creado_en > now() - interval '90 days') / 3.0 AS por_mes,
               round(avg(p.total_centavos))::bigint AS ticket,
               (SELECT count(*) FROM cuentas_por_cobrar c
                 WHERE c.org_id = p.org_id AND c.tienda_id = p.tienda_id AND c.estado = 'vencida') AS vencidas
          FROM pedidos p
         WHERE p.org_id IN (${orgs}) AND p.estado <> 'RECHAZADO'
         GROUP BY 1, 2) t;

-- Riesgo de mora (lo que dejaría el ML nocturno): más cuentas vencidas y más deuda, más riesgo
DELETE FROM riesgo_mora WHERE org_id IN (${orgs});
INSERT INTO riesgo_mora (org_id, tienda_id, tienda_nombre, riesgo, saldo_centavos, cuentas_vencidas)
SELECT org_id, tienda_id, max(tienda_nombre),
       round((1 / (1 + exp(-(-2.3 + 1.1 * count(*) FILTER (WHERE estado = 'vencida')
                              + 0.0000012 * sum(saldo_centavos)))))::numeric, 4),
       sum(saldo_centavos), count(*) FILTER (WHERE estado = 'vencida')
  FROM cuentas_por_cobrar
 WHERE org_id IN (${orgs}) AND estado <> 'pagada' AND saldo_centavos > 0
 GROUP BY 1, 2;
COMMIT;
`;

const nuevas = tiendas.filter((t) => !t.deLaSemilla);
const jsCatalogo = `// Carga masiva (scripts/carga-masiva.mjs): tiendas y su relación con los mayoristas de la red privada
const d = db.getSiblingDB('catalogo');
const tiendas = ${JSON.stringify(nuevas.map((t) => ({ _id: t.id, nombre: t.nombre, ciudad: t.ciudad, negocio: t.negocio, mayoristas: t.mayoristas, alta: t.alta.toISOString() })))};
d.organizaciones.deleteMany({ cargaMasiva: true });
d.relaciones.deleteMany({ cargaMasiva: true });
d.organizaciones.insertMany(tiendas.map((t) => ({
  _id: t._id, nombre: t.nombre, tipo: 'tienda', ciudad: t.ciudad, verificacion: 'VERIFICADO', verificado: true,
  negocio: { tipo: t.negocio.tipo, subtipo: t.negocio.subtipo, elegido_en: t.alta }, cargaMasiva: true,
})));
const listas = ['NUEVOS', 'FRECUENTES', 'FRECUENTES', 'VIP'];
const relaciones = [];
tiendas.forEach((t, i) => t.mayoristas.filter((m) => ${JSON.stringify(Object.keys(MAYORISTAS).filter((m) => MAYORISTAS[m].redPrivada))}.includes(m))
  .forEach((m) => relaciones.push({ _id: t._id + '|' + m, tienda_id: t._id, mayorista_id: m, estado: 'APROBADA', lista: listas[i % listas.length], cargaMasiva: true })));
if (relaciones.length) d.relaciones.insertMany(relaciones);
print('catalogo: ' + tiendas.length + ' tiendas y ' + relaciones.length + ' relaciones');
`;

mkdirSync(salida, { recursive: true });
writeFileSync(join(salida, 'catalogo.js'), jsCatalogo);
writeFileSync(join(salida, 'pedidos.sql'), sqlPedidos);
writeFileSync(join(salida, 'reportes.sql'), sqlReportes);

// ── Resumen ─────────────────────────────────────────────────────────────────────────────────────────────────────
const bs = (c) => `Bs ${(c / 100).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const vendidos = pedidos.filter((p) => ESTADOS_VENDIDOS.includes(p.estado));
console.log(`Desde ${dia(DESDE)} hasta ${hoyBolivia}: ${pedidos.length} pedidos, ${pedidos.reduce((s, p) => s + p.lineas.length, 0)} líneas, ${tiendas.length} tiendas (${nuevas.length} nuevas)`);
for (const m of Object.keys(MAYORISTAS)) {
  const suyos = vendidos.filter((p) => p.mayorista === m);
  console.log(`  ${m.padEnd(7)} ${String(pedidos.filter((p) => p.mayorista === m).length).padStart(5)} pedidos · vendido ${bs(suyos.reduce((s, p) => s + p.total, 0))}`);
}
const porMes = {};
for (const p of vendidos) porMes[dia(p.fecha).slice(0, 7)] = (porMes[dia(p.fecha).slice(0, 7)] ?? 0) + 1;
console.log('  por mes: ' + Object.entries(porMes).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log(`  rechazados ${pedidos.filter((p) => p.estado === 'RECHAZADO').length} · a crédito ${cuentas.length} (vencidas ${cuentas.filter((c) => c.estado === 'vencida').length}) · reclamos ${reclamos.length}`);

if (SOLO_ARCHIVOS) {
  console.log(`Archivos en ${salida}: catalogo.js (mongosh), pedidos.sql y reportes.sql (psql)`);
  process.exit(0);
}

console.log(docker('mongo', ['mongosh', '--quiet', '--eval', jsCatalogo]).split('\n').filter((l) => l.includes('catalogo:')).join('\n'));
docker('postgres', ['psql', '-U', 'abasto', '-d', 'pedidos', '-v', 'ON_ERROR_STOP=1', '-q'], sqlPedidos);
console.log('pedidos: cargados');
docker('postgres', ['psql', '-U', 'abasto', '-d', 'reportes', '-v', 'ON_ERROR_STOP=1', '-q'], sqlReportes);
console.log('reportes: cargados (pedidos, ventas del día y por producto, cuentas, stock, demanda, segmentos y mora)');
