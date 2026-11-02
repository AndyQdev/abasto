import { describe, expect, it } from 'vitest';
import type { Mayorista, Producto } from './catalogo';
import { esParaSuNegocio, esTipoDeNegocio, leerNegocio, negocioCompleto, nombreDelNegocio, pedidoDeLaSemana, rubrosDelNegocio, seccionesDelNegocio, usoDelNegocio, type NegocioElegido } from './negocios';

const dinero = (centavos: number) => ({ centavos, texto: `Bs ${(centavos / 100).toFixed(2).replace('.', ',')}` });
const abasto: Mayorista = { id: 'abasto', nombre: 'Abasto', ciudad: 'Santa Cruz', verificado: true, relacion: 'NINGUNA', deLaCasa: true };
const afiliado: Mayorista = { ...abasto, id: 'lp', nombre: 'Distribuidora Los Pozos', deLaCasa: false, relacion: 'APROBADA' };

function producto(id: string, nombre: string, rubro: string, centavos: number, extra: Partial<Producto> = {}): Producto {
  return {
    id,
    codigo: id,
    nombre,
    rubro,
    descripcion: '',
    stock: 0,
    estado: 'ACTIVO',
    precioVisible: true,
    abastecimiento: 'BAJO_PEDIDO',
    entregaHoras: 24,
    mayorista: abasto,
    escalas: [{ presentacion: 'UNIDAD', cantidad: 1, precioUnitario: dinero(centavos) }],
    ...extra,
  };
}

// Los usos son los de la semilla del catálogo real (02/11): a quién se le muestra cada producto en el Inicio
const S = ['salteneria'];
const harinaQuintal = producto('AB-101', 'Harina de trigo · quintal 46 kg', 'Harinas y panificación', 28500, { precioPorConfirmar: true, usos: ['salteneria', 'panaderia'] });
const harinaArroba = producto('AB-102', 'Harina de trigo · arroba 11,5 kg', 'Harinas y panificación', 7600, { precioPorConfirmar: true, usos: ['tienda', 'salteneria', 'panaderia', 'polleria'] });
const harinaKilo = producto('AB-004', 'Harina Famosa 1 kg', 'Harinas y panificación', 980, { marca: 'Famosa', usos: ['hogar', 'tienda'] });
const manteca = producto('AB-106', 'Manteca vegetal · balde 15 kg', 'Aceites y grasas', 26000, { precioPorConfirmar: true, usos: ['salteneria', 'panaderia', 'horneados'] });
const aji = producto('AB-111', 'Ají colorado molido 1 kg', 'Condimentos', 4500, { precioPorConfirmar: true, usos: ['salteneria', 'pension', 'puesto'] });
const sal = producto('AB-007', 'Sal fina Lobos 1 kg', 'Condimentos', 640, { marca: 'Lobos', usos: ['hogar', 'tienda'] });
const levadura = producto('AB-104', 'Levadura seca instantánea 500 g', 'Harinas y panificación', 2800, { precioPorConfirmar: true, usos: ['panaderia'] });
const yogurt = producto('AB-018', 'Yogurt bebible PIL durazno 1 L', 'Huevos y lácteos', 2120, { marca: 'PIL', usos: ['hogar', 'tienda'] });
const huevo = producto('AB-115', 'Huevo · maple de 30', 'Huevos y lácteos', 3200, { precioPorConfirmar: true, usos: ['hogar', 'tienda', 'salteneria', 'panaderia', 'horneados', 'pension', 'polleria', 'puesto'] });
const bolsas = producto('AB-119', 'Bolsas plásticas medianas · paquete de 100', 'Descartables', 1200, { usos: ['tienda', 'salteneria', 'pension'] });
const envases = producto('AB-120', 'Envase de plastoformo con tapa · paquete de 100', 'Descartables', 6500, { usos: ['pension'] });
const shampoo = producto('AB-032', 'Shampoo Sedal 340 ml', 'Higiene y cuidado personal', 2830, { usos: ['hogar', 'tienda'] });
const arrozAjeno = producto('Z-1', 'Arroz de otro mayorista 1 kg', 'Granos y cereales', 100, { mayorista: afiliado, usos: ['hogar', 'tienda', 'pension'] });
const pausado = producto('AB-200', 'Harina vieja · quintal', 'Harinas y panificación', 100, { estado: 'PAUSADO', usos: S });
const sinUsos = producto('AB-300', 'Producto de antes, sin usos', 'Varios', 100);
const detergente = producto('AB-025', 'Detergente Skip 700 g', 'Limpieza del hogar', 2500, { marca: 'Skip', usos: ['hogar', 'tienda'] });
const arroz = producto('AB-001', 'Arroz Caisy Grano de Oro 1 kg', 'Granos y cereales', 1540, { marca: 'Caisy', usos: ['hogar', 'tienda'] });
const todos = [harinaQuintal, harinaArroba, harinaKilo, manteca, aji, sal, levadura, yogurt, huevo, bolsas, envases, shampoo, arrozAjeno, pausado, sinUsos, detergente, arroz];

const HOGAR: NegocioElegido = { tipo: 'hogar' };
const TIENDA: NegocioElegido = { tipo: 'tienda' };
const SALTENERIA: NegocioElegido = { tipo: 'productor', subtipo: 'salteneria' };
const PANADERIA: NegocioElegido = { tipo: 'productor', subtipo: 'panaderia' };
const PENSION: NegocioElegido = { tipo: 'productor', subtipo: 'pension' };
const ids = (n: NegocioElegido, recetas?: Parameters<typeof seccionesDelNegocio>[3]) => seccionesDelNegocio(n, todos, 10, recetas).flatMap((s) => s.tarjetas.map((t) => t.producto.id));

describe('qué ve cada uno (usos)', () => {
  it('el panadero no ve yogurt; la tienda y el hogar sí', () => {
    expect(ids(PANADERIA)).not.toContain('AB-018');
    expect(ids(TIENDA)).toContain('AB-018');
    expect(ids(HOGAR)).toContain('AB-018');
  });

  it('la tienda no ve el balde de manteca, que es para el que cocina', () => {
    expect(ids(TIENDA)).not.toContain('AB-106');
    expect(ids(SALTENERIA)).toContain('AB-106');
  });

  it('un producto sin usos no sale en ningún Inicio (pero se encuentra al buscar)', () => {
    for (const n of [HOGAR, TIENDA, SALTENERIA, PANADERIA, PENSION]) expect(ids(n)).not.toContain('AB-300');
    expect(esParaSuNegocio(TIENDA, sinUsos)).toBe(false);
    expect(usoDelNegocio(PENSION)).toBe('pension');
  });

  it('solo entra lo que vende Abasto y lo que está activo', () => {
    expect(ids(PENSION)).not.toContain('Z-1');
    expect(ids(SALTENERIA)).not.toContain('AB-200');
  });
});

describe('rubros según el negocio', () => {
  it('a una salteñería solo le salen los rubros de lo suyo, en el orden del que cocina', () => {
    expect(rubrosDelNegocio(SALTENERIA, todos)).toEqual(['Harinas y panificación', 'Aceites y grasas', 'Huevos y lácteos', 'Condimentos', 'Descartables']);
  });

  it('a una tienda sí le sale Higiene', () => {
    expect(rubrosDelNegocio(TIENDA, todos)).toContain('Higiene y cuidado personal');
  });

  it('el hogar ve primero lo de la despensa y también la limpieza, pero no los descartables', () => {
    const r = rubrosDelNegocio(HOGAR, todos);
    expect(r[0]).toBe('Granos y cereales');
    expect(r).toContain('Limpieza del hogar');
    expect(r).not.toContain('Descartables');
  });
});

describe('secciones según el negocio', () => {
  const seccion = (n: NegocioElegido, clave: string) => seccionesDelNegocio(n, todos).find((s) => s.clave === clave);

  it('«Lo que más se pide en tu rubro»: lo que llevan las recetas de su área, del más usado al menos', () => {
    const rubro = seccion(SALTENERIA, 'rubro')!;
    expect(rubro.titulo).toBe('Lo que más se pide en tu rubro');
    // Harina, manteca y huevo van en las tres plantillas de la salteñería (primero lo más grande); el ají, en dos
    expect(rubro.tarjetas.map((t) => t.producto.id)).toEqual(['AB-101', 'AB-106', 'AB-102', 'AB-115', 'AB-111']);
  });

  it('el precio de demostración se avisa en la etiqueta de la tarjeta', () => {
    const [quintal] = seccion(SALTENERIA, 'rubro')!.tarjetas;
    expect(quintal).toMatchObject({ gancho: 'Por confirmar', precio: 'Bs 285,00', detalle: 'c/u' });
  });

  it('«Para tu receta de…» va primero, con los insumos de sus recetas', () => {
    const recetas = { nombres: ['Salteña de carne'], productoIds: ['AB-111', 'AB-102'] };
    const [primera] = seccionesDelNegocio(SALTENERIA, todos, 10, recetas);
    expect(primera).toMatchObject({ clave: 'receta', titulo: 'Para tu receta de salteña de carne' });
    expect(primera.tarjetas.map((t) => t.producto.id)).toEqual(['AB-111', 'AB-102']);
    expect(seccionesDelNegocio(SALTENERIA, todos, 10, { nombres: ['A', 'B'], productoIds: ['AB-111'] })[0].titulo).toBe('Para tus recetas');
    // Sin recetas, no hay sección
    expect(seccion(SALTENERIA, 'receta')).toBeUndefined();
  });

  it('una pensión ve «Para llevar» con los descartables y nunca «Gana revendiendo»', () => {
    const claves = seccionesDelNegocio(PENSION, todos).map((s) => s.clave);
    expect(claves).toContain('descartables');
    expect(claves).not.toContain('reventa');
    expect(claves).not.toContain('super');
  });

  it('«También te puede servir» sugiere lo demás que es para él, sin repetir', () => {
    expect(seccion(SALTENERIA, 'sugeridos')!.tarjetas.map((t) => t.producto.id)).toEqual(['AB-119']);
    expect(seccion(SALTENERIA, 'sugeridos')!.subtitulo).toContain('salteñería');
    expect(seccion(TIENDA, 'sugeridos')!.tarjetas.map((t) => t.producto.id)).toContain('AB-032');
    expect(ids(PENSION)).not.toContain('AB-032');
  });

  it('el hogar tiene su despensa y la limpieza de la casa, y nunca «Gana revendiendo»', () => {
    expect(seccion(HOGAR, 'despensa')!.tarjetas.map((t) => t.producto.id)).toContain('AB-001');
    expect(seccion(HOGAR, 'despensa')!.tarjetas.map((t) => t.producto.id)).not.toContain('AB-101'); // el quintal no es para la casa
    expect(seccion(HOGAR, 'casa')!.tarjetas.map((t) => t.producto.id)).toEqual(['AB-025', 'AB-032']);
    expect(seccionesDelNegocio(HOGAR, todos).map((s) => s.clave)).not.toContain('reventa');
  });

  it('la tienda ve primero lo que más se repone', () => {
    expect(seccion(TIENDA, 'repone')!.tarjetas.map((t) => t.producto.id).slice(0, 2)).toEqual(['AB-001', 'AB-115']);
  });

  it('una sección sin productos no se muestra', () => {
    expect(seccionesDelNegocio(PENSION, [shampoo]).map((s) => s.clave)).toEqual([]);
  });
});

describe('tu pedido de la semana', () => {
  const linea = (id: string, presentacion: string, cantidad: number, nombre = id) => ({ presentacion, cantidad, unidades: cantidad, producto: { id, nombre }, subtotal: { texto: '' } });

  it('repite el último pedido que no fue rechazado, con el precio de hoy', () => {
    const r = pedidoDeLaSemana(
      [
        { codigo: 'A-1', estado: 'ENTREGADO', creadoEn: '2026-10-20T10:00:00Z', lineas: [linea('AB-007', 'UNIDAD', 9)] },
        { codigo: 'A-2', estado: 'ENTREGADO', creadoEn: '2026-10-27T10:00:00Z', lineas: [linea('AB-101', 'UNIDAD', 2), linea('AB-106', 'UNIDAD', 1)] },
        { codigo: 'A-3', estado: 'RECHAZADO', creadoEn: '2026-10-30T10:00:00Z', lineas: [linea('AB-119', 'UNIDAD', 1)] },
      ],
      todos,
    )!;
    expect(r.codigo).toBe('A-2');
    expect(r.items.map((i) => [i.productoId, i.cantidad])).toEqual([
      ['AB-101', 2],
      ['AB-106', 1],
    ]);
    expect(r.totalTexto).toBe('Bs 830,00');
  });

  it('avisa lo que ya no se vende o cambió de presentación en vez de agregarlo', () => {
    const r = pedidoDeLaSemana(
      [{ codigo: 'A-4', estado: 'CONFIRMADO', creadoEn: '2026-10-31T10:00:00Z', lineas: [linea('AB-101', 'UNIDAD', 1), linea('AB-200', 'UNIDAD', 1, 'Harina vieja'), linea('AB-111', 'DOCENA', 1, 'Ají por docena')] }],
      todos,
    )!;
    expect(r.items).toHaveLength(1);
    expect(r.faltan).toEqual(['Harina vieja', 'Ají por docena']);
  });

  it('sin pedidos, no hay pedido de la semana', () => {
    expect(pedidoDeLaSemana([], todos)).toBeNull();
  });
});

describe('el negocio guardado en el teléfono', () => {
  it('reconoce los tres tipos', () => {
    expect(esTipoDeNegocio('hogar')).toBe(true);
    expect(esTipoDeNegocio('productor')).toBe(true);
    expect(esTipoDeNegocio('familia')).toBe(false);
    expect(esTipoDeNegocio(null)).toBe(false);
  });

  it('traduce lo guardado antes del 01/11', () => {
    expect(leerNegocio('tienda')).toEqual({ tipo: 'tienda' });
    expect(leerNegocio('masas')).toEqual({ tipo: 'productor', subtipo: 'salteneria' });
    expect(leerNegocio('cocina')).toEqual({ tipo: 'productor', subtipo: 'pension' });
  });

  it('el productor sin subtipo no está completo: el registro vuelve a preguntar', () => {
    expect(leerNegocio({ tipo: 'productor' })).toBeNull();
    expect(negocioCompleto({ tipo: 'productor' })).toBe(false);
    expect(leerNegocio({ tipo: 'productor', subtipo: 'panaderia' })).toEqual(PANADERIA);
    expect(leerNegocio({ tipo: 'hogar', subtipo: 'panaderia' })).toEqual(HOGAR);
    expect(leerNegocio('otra cosa')).toBeNull();
  });

  it('el nombre corto es el subtipo del productor', () => {
    expect(nombreDelNegocio(SALTENERIA)).toBe('Salteñería');
    expect(nombreDelNegocio(HOGAR)).toBe('Hogar');
  });
});
