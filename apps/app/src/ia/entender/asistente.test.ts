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
    expect(p.receta?.id).toBe('saltena-carne');
    // 2 kg por cada 50 salteñas (plantilla de Mi negocio) → 12 kg → 1 quintal de 46 kg
    expect(p.lineas.find((l) => l.producto?.codigo === 'AB-050')).toMatchObject({ cantidad: 1, nota: 'Pediste 12 kg: con esto llevas 46 kg' });
    // 4 en la masa + 8 duros en el relleno por cada 50 → 72 → 3 maples de 30
    expect(p.lineas.find((l) => l.producto?.codigo === 'AB-060')?.cantidad).toBe(3);
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

  it('«quiero hacer 100 empanadas de queso»: si el modelo trae solo el queso, se usa la receta completa (Honor, 10/11)', async () => {
    const interprete = interpreteQueDevuelve({ tipo: 'pedido', items: [{ nombre: 'queso', cantidad: 100, unidad: 'g', envase: null }], preparacion: null, rinde: null, supuestos: [] });
    const p = await proponerCompra({ texto: 'quiero hacer 100 empanadas de queso' }, catalogo, { interprete });
    expect(p.receta).not.toBeNull();
    expect(p.intencion.items.length).toBeGreaterThan(1);
  });

  it('una receta que no conocemos pide los ingredientes en vez de inventarlos', async () => {
    const interprete = interpreteQueDevuelve({ tipo: 'receta', items: [], preparacion: 'sushi', rinde: 40, supuestos: [] });
    const p = await proponerCompra({ texto: 'quiero hacer sushi' }, catalogo, { interprete });
    expect(p.lineas).toEqual([]);
    expect(p.supuestos[0]).toContain('pega tu receta');
  });

  const foto = { texto: '', fotoUri: 'file:///foto.jpg' };
  const vio = (productos: { codigo: string; confianza: number }[], platos: { codigo: string; confianza: number }[]) => ({
    reconocerFoto: async () => ({ productos, platos }),
  });

  it('una foto de un producto: el reconocedor propio dice cuál es', async () => {
    const p = await proponerCompra(foto, catalogo, vio([{ codigo: 'AB-005', confianza: 0.9 }], [{ codigo: 'salchipapa', confianza: 0.4 }]));
    expect(p.origen).toBe('foto');
    expect(p.mensaje).toBe('Es Aceite Fino 900 ml (90 %).');
    expect(p.lineas[0].producto?.codigo).toBe('AB-005');
  });

  it('una foto de salchipapa: dice que parece, usa su receta y ofrece las otras formas de prepararla', async () => {
    const p = await proponerCompra({ ...foto, texto: 'para 8 personas' }, catalogo, vio([], [{ codigo: 'salchipapa', confianza: 0.88 }, { codigo: 'silpancho', confianza: 0.7 }]));
    expect(p.mensaje).toContain('Parece salchipapa (88 %)');
    expect(p.variantes.map((r) => r.id)).toEqual(['salchipapa', 'salchipapa-huevo']);
    expect(p.receta?.id).toBe('salchipapa');
    // 3 L de aceite para 20 porciones → 1,2 L para 8 → 2 botellas de 900 ml
    expect(p.lineas.find((l) => l.producto?.codigo === 'AB-005')?.cantidad).toBe(2);
  });

  it('si duda entre dos platos, pregunta «¿Es esto?» y no arma nada hasta que la persona elija', async () => {
    const p = await proponerCompra(foto, catalogo, vio([], [{ codigo: 'majadito', confianza: 0.85 }, { codigo: 'silpancho', confianza: 0.836 }]));
    expect(p.mensaje).toBe('¿Es majadito o silpancho? Elige y te armamos la compra.');
    expect(p.lineas).toEqual([]);
    const elegido = await proponerCompra(foto, catalogo, { ...vio([], []), platoElegido: 'silpancho' });
    expect(elegido.receta?.id).toBe('silpancho');
  });

  it('si la foto reconoce el plato y el modelo también respondió, no dice que la IA falló (10/11, Honor)', async () => {
    const interprete = interpreteQueDevuelve({ tipo: 'receta', items: [], preparacion: 'salteña', rinde: null, supuestos: [] });
    const p = await proponerCompra(foto, catalogo, { interprete, ...vio([], [{ codigo: 'saltena', confianza: 0.9 }]) });
    expect(p.origen).toBe('foto');
    expect(p.falloDelModelo).toBeNull();
  });

  it('si el modelo de verdad no entendió, sí lo dice', async () => {
    const p = await proponerCompra(foto, catalogo, { interprete: interpreteQueDevuelve(null), ...vio([], [{ codigo: 'saltena', confianza: 0.9 }]) });
    expect(p.falloDelModelo).not.toBeNull();
  });

  it('una foto que no se parece a nada lo dice', async () => {
    const p = await proponerCompra(foto, catalogo, vio([{ codigo: 'AB-005', confianza: 0.2 }], [{ codigo: 'silpancho', confianza: 0.44 }]));
    expect(p.lineas).toEqual([]);
    expect(p.mensaje).toContain('No reconocimos la foto');
  });
});
