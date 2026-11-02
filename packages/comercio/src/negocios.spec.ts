import { describe, expect, it } from 'vitest';
import type { Mayorista, Producto } from './catalogo';
import { esTipoDeNegocio, pedidoDeLaSemana, rubrosDelNegocio, seccionesDelNegocio } from './negocios';

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

const harinaQuintal = producto('AB-101', 'Harina de trigo · quintal 46 kg', 'Harinas y panificación', 28500, { precioPorConfirmar: true });
const harinaKilo = producto('AB-004', 'Harina Famosa 1 kg', 'Harinas y panificación', 980, { marca: 'Famosa' });
const manteca = producto('AB-106', 'Manteca vegetal · balde 15 kg', 'Aceites y grasas', 26000, { precioPorConfirmar: true });
const aji = producto('AB-111', 'Ají colorado molido 1 kg', 'Condimentos', 4500, { precioPorConfirmar: true });
const sal = producto('AB-007', 'Sal fina Lobos 1 kg', 'Condimentos', 640, { marca: 'Lobos' });
const salsa = producto('X-1', 'Salsa de tomate 1 kg', 'Condimentos', 900);
const bolsas = producto('AB-119', 'Bolsas plásticas medianas · paquete de 100', 'Descartables', 1200);
const shampoo = producto('AB-032', 'Shampoo Sedal 340 ml', 'Higiene y cuidado personal', 2830);
const arrozAjeno = producto('Z-1', 'Arroz de otro mayorista 1 kg', 'Granos y cereales', 100, { mayorista: afiliado });
const pausado = producto('AB-200', 'Harina vieja · quintal', 'Harinas y panificación', 100, { estado: 'PAUSADO' });
const todos = [harinaQuintal, harinaKilo, manteca, aji, sal, salsa, bolsas, shampoo, arrozAjeno, pausado];

describe('rubros según el negocio', () => {
  it('a una salteñería no se le muestran Higiene ni Bebidas, y van en el orden del que cocina', () => {
    expect(rubrosDelNegocio('masas', todos)).toEqual(['Harinas y panificación', 'Aceites y grasas', 'Granos y cereales', 'Condimentos', 'Descartables']);
  });

  it('a una tienda sí le sale Higiene', () => {
    expect(rubrosDelNegocio('tienda', todos)).toContain('Higiene y cuidado personal');
  });
});

describe('secciones según el negocio', () => {
  const seccion = (tipo: Parameters<typeof seccionesDelNegocio>[0], clave: string) => seccionesDelNegocio(tipo, todos).find((s) => s.clave === clave);

  it('«Para tu salteñería» sigue el orden de los ingredientes y pone el quintal antes que el kilo', () => {
    const ids = seccion('masas', 'salteneria')!.tarjetas.map((t) => t.producto.id);
    expect(ids.slice(0, 4)).toEqual(['AB-101', 'AB-004', 'AB-106', 'AB-111']);
  });

  it('el precio de demostración se avisa en la etiqueta de la tarjeta', () => {
    const [quintal] = seccion('masas', 'salteneria')!.tarjetas;
    expect(quintal).toMatchObject({ gancho: 'Por confirmar', precio: 'Bs 285,00', detalle: 'c/u' });
  });

  it('busca la palabra entera: «sal» no trae la salsa', () => {
    const ids = seccion('masas', 'panaderia')!.tarjetas.map((t) => t.producto.id);
    expect(ids).toContain('AB-007');
    expect(ids).not.toContain('X-1');
  });

  it('solo entra lo que vende Abasto y lo que está activo', () => {
    const ids = seccionesDelNegocio('cocina', todos).flatMap((s) => s.tarjetas.map((t) => t.producto.id));
    expect(ids).not.toContain('Z-1');
    expect(ids).not.toContain('AB-200');
  });

  it('una pensión ve «Para llevar» con los descartables y nunca «Gana revendiendo»', () => {
    const claves = seccionesDelNegocio('cocina', todos).map((s) => s.clave);
    expect(claves).toContain('descartables');
    expect(claves).not.toContain('reventa');
    expect(claves).not.toContain('super');
  });

  it('«También te puede servir» sugiere lo demás de sus rubros, sin repetir lo de sus secciones', () => {
    const ids = seccion('masas', 'sugeridos')!.tarjetas.map((t) => t.producto.id);
    expect(ids).toEqual(['X-1', 'AB-119']);
    expect(seccion('masas', 'sugeridos')!.subtitulo).toContain('salteñería');
    // A una tienda sí se le sugiere higiene; a una pensión nunca
    expect(seccion('tienda', 'sugeridos')!.tarjetas.map((t) => t.producto.id)).toContain('AB-032');
    expect(seccionesDelNegocio('cocina', todos).flatMap((s) => s.tarjetas.map((t) => t.producto.id))).not.toContain('AB-032');
  });

  it('una sección sin productos no se muestra', () => {
    expect(seccionesDelNegocio('cocina', [shampoo]).map((s) => s.clave)).toEqual([]);
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

it('reconoce el negocio guardado en el teléfono', () => {
  expect(esTipoDeNegocio('masas')).toBe(true);
  expect(esTipoDeNegocio('familia')).toBe(false);
  expect(esTipoDeNegocio(null)).toBe(false);
});
