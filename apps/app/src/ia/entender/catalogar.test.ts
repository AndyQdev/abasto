import type { Escala, Mayorista, Producto } from '@abasto/comercio';
import { candidatos, catalogarItem, contenidoDe, parecidoDeNombre, porCodigos } from './catalogar';
import type { ItemPedido } from './intencion';

const abasto: Mayorista = { id: 'abasto', nombre: 'Abasto', ciudad: 'Santa Cruz', verificado: true, relacion: 'NINGUNA', deLaCasa: true };
const precio = (centavos: number) => ({ centavos, texto: `Bs ${centavos / 100}` });
const escala = (presentacion: Escala['presentacion'], cantidad: number, centavos: number): Escala => ({
  presentacion,
  cantidad,
  precioUnitario: precio(centavos),
});

function producto(id: string, nombre: string, rubro: string, escalas: Escala[]): Producto {
  return {
    id,
    codigo: id,
    nombre,
    rubro,
    descripcion: '',
    stock: 100,
    estado: 'ACTIVO',
    precioVisible: true,
    abastecimiento: 'BAJO_PEDIDO',
    entregaHoras: 24,
    mayorista: abasto,
    escalas,
  };
}

const aceite = producto('AB-005', 'Aceite Fino 900 ml', 'Abarrotes', [escala('UNIDAD', 1, 1600), escala('CAJA', 12, 1450)]);
const arroz = producto('AB-001', 'Arroz Caisy Grano de Oro 1 kg', 'Abarrotes', [escala('UNIDAD', 1, 1100), escala('FARDO', 24, 1000)]);
const harina = producto('AB-050', 'Harina de trigo · quintal 46 kg', 'Harinas y panificación', [escala('UNIDAD', 1, 32000)]);
const huevo = producto('AB-060', 'Huevo · maple de 30', 'Huevos y lácteos', [escala('UNIDAD', 1, 3200)]);
const leche = producto('AB-017', 'Leche PIL fresca 900 ml', 'Lácteos', [escala('UNIDAD', 1, 750), escala('DOCENA', 12, 700)]);
const catalogo = [aceite, arroz, harina, huevo, leche];

const pide = (nombre: string, cantidad: number | null, envase: string | null = null, unidad: ItemPedido['unidad'] = null): ItemPedido => ({
  nombre,
  cantidad,
  envase,
  unidad,
});

describe('Encontrar el producto por cómo lo nombró la persona', () => {
  it('«huevos» encuentra «Huevo · maple de 30» y «aceite» al Aceite Fino', () => {
    expect(candidatos('huevos', catalogo)[0]).toBe(huevo);
    expect(candidatos('aceite', catalogo)[0]).toBe(aceite);
  });

  it('el nombre pesa más que el rubro y lo que no se parece no entra', () => {
    expect(parecidoDeNombre('leche', leche)).toBeGreaterThan(parecidoDeNombre('leche', huevo));
    expect(candidatos('detergente', catalogo)).toEqual([]);
  });

  it('sabe cuánto trae cada producto', () => {
    expect(contenidoDe(harina)).toMatchObject({ cantidad: 46, unidad: 'kg' });
    expect(contenidoDe(aceite)).toMatchObject({ cantidad: 0.9, unidad: 'L' });
    expect(contenidoDe(huevo)).toMatchObject({ cantidad: 30, unidad: 'u.' });
  });
});

describe('Convertir lo pedido en presentaciones del catálogo', () => {
  it('«3 cajas de aceite» y «2 fardos de arroz» van tal cual', () => {
    expect(catalogarItem(pide('aceite', 3, 'caja'), catalogo)).toMatchObject({ producto: aceite, cantidad: 3, certeza: 'exacta', escala: { presentacion: 'CAJA' } });
    expect(catalogarItem(pide('arroz', 2, 'fardo'), catalogo)).toMatchObject({ producto: arroz, cantidad: 2, escala: { presentacion: 'FARDO' } });
  });

  it('«5 docenas de leche» usa la docena', () => {
    expect(catalogarItem(pide('leche', 5, 'docena'), catalogo)).toMatchObject({ cantidad: 5, escala: { presentacion: 'DOCENA' } });
  });

  it('«2 quintales de harina» y «3 maples de huevo»: el envase es el producto mismo', () => {
    expect(catalogarItem(pide('harina', 2, 'quintal'), catalogo)).toMatchObject({ producto: harina, cantidad: 2, certeza: 'exacta' });
    expect(catalogarItem(pide('huevos', 3, 'maple'), catalogo)).toMatchObject({ producto: huevo, cantidad: 3, certeza: 'exacta' });
  });

  it('«25 kg de harina» redondea hacia arriba y explica cuánto lleva', () => {
    const linea = catalogarItem(pide('harina', 25, null, 'kg'), catalogo);
    expect(linea).toMatchObject({ producto: harina, cantidad: 1, certeza: 'aproximada' });
    expect(linea.nota).toBe('Pediste 25 kg: con esto llevas 46 kg');
  });

  it('«3 L de aceite» son 4 botellas de 900 ml, y «60 huevos» 2 maples', () => {
    expect(catalogarItem(pide('aceite', 3, null, 'L'), catalogo)).toMatchObject({ cantidad: 4, nota: 'Pediste 3 L: con esto llevas 3,6 L' });
    expect(catalogarItem(pide('huevos', 60, null, 'u.'), catalogo)).toMatchObject({ cantidad: 2 });
  });

  it('un envase que el producto no tiene cae en la presentación por defecto y lo avisa', () => {
    const linea = catalogarItem(pide('arroz', 2, 'caja'), catalogo);
    expect(linea).toMatchObject({ producto: arroz, certeza: 'aproximada', cantidad: 2 });
    expect(linea.nota).toContain('No se vende por caja');
  });

  it('lo que no está en el catálogo se dice, nunca se inventa', () => {
    expect(catalogarItem(pide('chocolate blanco', 1), catalogo)).toMatchObject({ producto: null, certeza: 'sin_producto', cantidad: 0 });
  });
});

describe('Insumos de una receta con códigos del catálogo', () => {
  const arroba = producto('AB-102', 'Harina de trigo · arroba 11,5 kg', 'Harinas y panificación', [escala('UNIDAD', 1, 9000)]);
  const quintal = producto('AB-101', 'Harina de trigo · quintal 46 kg', 'Harinas y panificación', [escala('UNIDAD', 1, 32000)]);
  const conHarinas = [...catalogo, arroba, quintal];
  const deReceta = (cantidad: number): ItemPedido => ({ nombre: 'harina de trigo', cantidad, unidad: 'kg', envase: null, codigos: ['AB-102', 'AB-101'] });

  it('elige la presentación más grande que no se pasa de lo pedido', () => {
    expect(porCodigos(deReceta(12), conHarinas).map((p) => p.codigo)).toEqual(['AB-102', 'AB-101']);
    expect(porCodigos(deReceta(60), conHarinas)[0].codigo).toBe('AB-101');
    expect(porCodigos(deReceta(2), conHarinas)[0].codigo).toBe('AB-102');
  });

  it('usa el código antes que el nombre y, si el código no está a la venta, vuelve al nombre', () => {
    expect(catalogarItem(deReceta(12), conHarinas).producto?.codigo).toBe('AB-102');
    expect(catalogarItem(deReceta(12), catalogo).producto?.codigo).toBe('AB-050');
  });
});
