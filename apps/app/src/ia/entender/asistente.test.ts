import type { Escala, Mayorista, Producto } from '@abasto/comercio';
import type { Interprete } from '../local/motor';
import { manifiesto } from '../local/modelos';
import { proponerCompra } from './asistente';
import type { Intencion } from './intencion';

const abasto: Mayorista = { id: 'abasto', nombre: 'Abasto', ciudad: 'Santa Cruz', verificado: true, relacion: 'NINGUNA', deLaCasa: true };
const escala = (presentacion: Escala['presentacion'], cantidad: number): Escala => ({ presentacion, cantidad, precioUnitario: { centavos: 1000, texto: 'Bs 10' } });
const producto = (id: string, nombre: string, escalas: Escala[]): Producto => ({
  id,
  codigo: id,
  nombre,
  rubro: 'Abarrotes',
  descripcion: '',
  stock: 100,
  estado: 'ACTIVO',
  precioVisible: true,
  abastecimiento: 'BAJO_PEDIDO',
  entregaHoras: 24,
  mayorista: abasto,
  escalas,
});

const catalogo = [
  producto('AB-005', 'Aceite Fino 900 ml', [escala('UNIDAD', 1), escala('CAJA', 12)]),
  producto('AB-001', 'Arroz Caisy Grano de Oro 1 kg', [escala('UNIDAD', 1), escala('FARDO', 24)]),
  producto('AB-050', 'Harina de trigo · quintal 46 kg', [escala('UNIDAD', 1)]),
  producto('AB-060', 'Huevo · maple de 30', [escala('UNIDAD', 1)]),
  producto('AB-061', 'Manteca vegetal · balde 4 kg', [escala('UNIDAD', 1)]),
];

const interpreteQueDevuelve = (intencion: Intencion | null): Interprete => ({
  modelo: manifiesto.modelos[0],
  veFotos: true,
  interpretar: async () => intencion,
  diagnostico: () => (intencion ? null : { cargaMs: 0, respuestaMs: 1, crudo: null, error: 'grammar error' }),
  liberar: async () => {},
});

describe('Asistente de compra', () => {
  it('sin modelo, las reglas entienden la lista y el código arma el carrito', async () => {
    const p = await proponerCompra({ texto: 'necesito tres cajas de aceite y dos fardos de arroz' }, catalogo);
    expect(p.origen).toBe('reglas');
    expect(p.lineas.map((l) => [l.producto?.codigo, l.escala?.presentacion, l.cantidad])).toEqual([
      ['AB-005', 'CAJA', 3],
      ['AB-001', 'FARDO', 2],
    ]);
  });

  it('con el modelo local, usa lo que entendió el modelo', async () => {
    const interprete = interpreteQueDevuelve({
      tipo: 'pedido',
      items: [{ nombre: 'harina', cantidad: 2, unidad: null, envase: 'quintal' }],
      preparacion: null,
      rinde: null,
      supuestos: [],
    });
    const p = await proponerCompra({ texto: 'mándame un par de quintales de harina' }, catalogo, { interprete });
    expect(p.origen).toBe('modelo');
    expect(p.lineas[0]).toMatchObject({ cantidad: 2, certeza: 'exacta', producto: { codigo: 'AB-050' } });
  });

  it('si el modelo no entiende, siguen las reglas: nunca se queda sin respuesta', async () => {
    const p = await proponerCompra({ texto: '2 fardos de arroz' }, catalogo, { interprete: interpreteQueDevuelve(null) });
    expect(p.origen).toBe('reglas');
    expect(p.lineas[0].producto?.codigo).toBe('AB-001');
    expect(p.falloDelModelo).toBe('grammar error');
  });

  it('«300 salteñas» usa la receta de referencia, escala con aritmética y dice lo que supuso', async () => {
    const interprete = interpreteQueDevuelve({ tipo: 'receta', items: [], preparacion: 'salteñas', rinde: 300, supuestos: [] });
    const p = await proponerCompra({ texto: 'quiero hacer 300 salteñas' }, catalogo, { interprete });
    expect(p.receta?.id).toBe('saltena');
    // 4 kg por cada 100 salteñas → 12 kg → 1 quintal de 46 kg
    expect(p.lineas.find((l) => l.producto?.codigo === 'AB-050')).toMatchObject({ cantidad: 1, nota: 'Pediste 12 kg: con esto llevas 46 kg' });
    // 10 huevos por cada 100 → 30 → 1 maple
    expect(p.lineas.find((l) => l.producto?.codigo === 'AB-060')?.cantidad).toBe(1);
    expect(p.supuestos.some((s) => s.includes('receta de referencia'))).toBe(true);
    // Lo que no vendemos (carne, papa…) se dice, no se inventa
    expect(p.lineas.some((l) => l.certeza === 'sin_producto' && l.pedido.nombre === 'carne de res')).toBe(true);
  });

  it('si el modelo pide «100 empanadas» como producto, el código lo convierte en la receta de referencia (pasó con LFM2.5 en el TECNO)', async () => {
    const interprete = interpreteQueDevuelve({
      tipo: 'pedido',
      items: [{ nombre: 'empanadas de queso', cantidad: 100, unidad: null, envase: null }],
      preparacion: null,
      rinde: null,
      supuestos: [],
    });
    const p = await proponerCompra({ texto: 'quiero hacer 100 empanadas de queso' }, catalogo, { interprete });
    expect(p.receta?.id).toBe('empanada-queso');
    expect(p.lineas.find((l) => l.producto?.codigo === 'AB-050')).toMatchObject({ cantidad: 1 });
    expect(p.lineas.some((l) => l.pedido.nombre === 'empanadas de queso')).toBe(false);
  });

  it('una receta que no conocemos pide los ingredientes en vez de inventarlos', async () => {
    const interprete = interpreteQueDevuelve({ tipo: 'receta', items: [], preparacion: 'sushi', rinde: 40, supuestos: [] });
    const p = await proponerCompra({ texto: 'quiero hacer sushi' }, catalogo, { interprete });
    expect(p.lineas).toEqual([]);
    expect(p.supuestos[0]).toContain('pega tu receta');
  });

  it('solo una foto y sin modelo que vea: el reconocedor de productos dice qué es', async () => {
    const p = await proponerCompra({ texto: '', fotoUri: 'file:///foto.jpg' }, catalogo, {
      reconocer: async () => [{ codigo: 'AB-005', confianza: 0.9 }],
    });
    expect(p.origen).toBe('foto');
    expect(p.lineas[0].producto?.codigo).toBe('AB-005');
  });

  it('una foto que no se parece a nada lo dice', async () => {
    const p = await proponerCompra({ texto: '', fotoUri: 'file:///foto.jpg' }, catalogo, { reconocer: async () => [{ codigo: 'AB-005', confianza: 0.2 }] });
    expect(p.lineas).toEqual([]);
    expect(p.supuestos[0]).toContain('No reconocimos la foto');
  });
});
