import { describe, expect, it } from 'vitest';
import { AlmacenEnMemoria, sincronizarCompras } from './almacen';
import { centavosDeTexto, claveDeCompra, comprasQueEntran, type PedidoComprado } from './compras';
import { equivalencia, leerCantidad, MEDIDAS_A_MANO, medidaDeContenido, textoDeCantidad } from './medidas';
import { ajusteAMano, articuloAMano, entradaAMano, ErrorDeInventario, existencias, inventarioDelNegocio, resumenDelInventario, type DatosDeNegocio } from './motor';

const AHORA = '2026-11-01T12:00:00.000Z';
const vacio = (): DatosDeNegocio => ({ articulos: [], movimientos: [] });

function linea(id: string, nombre: string, rubro: string, unidades: number, centavos: number, presentacion = 'UNIDAD') {
  return { presentacion, cantidad: unidades, unidades, producto: { id, nombre, rubro }, subtotal: { texto: '', centavos } };
}

const entregado: PedidoComprado = {
  id: 'p-1',
  codigo: 'A-0001',
  estado: 'ENTREGADO',
  lineas: [linea('AB-101', 'Harina de trigo · quintal 46 kg', 'Harinas y panificación', 2, 57000), linea('AB-114', 'Huevo · maple de 30', 'Huevos y lácteos', 3, 9150)],
};
const enCamino: PedidoComprado = { id: 'p-2', codigo: 'A-0002', estado: 'DESPACHADO', lineas: [linea('AB-005', 'Aceite Fino 900 ml', 'Aceites y grasas', 12, 21000)] };

describe('medidas: una cantidad nunca va sin unidad', () => {
  it('lee la medida del nombre del producto', () => {
    expect(medidaDeContenido('quintal 46 kg')).toEqual({ envase: 'quintal', porEnvase: 46, unidad: 'kg' });
    expect(medidaDeContenido('arroba 11,5 kg')).toEqual({ envase: 'arroba', porEnvase: 11.5, unidad: 'kg' });
    expect(medidaDeContenido('maple de 30')).toEqual({ envase: 'maple', porEnvase: 30, unidad: 'u.' });
    expect(medidaDeContenido('bidón 5 L')).toEqual({ envase: 'bidón', porEnvase: 5, unidad: 'L' });
    expect(medidaDeContenido('900 ml')).toEqual({ envase: 'unidad', porEnvase: 900, unidad: 'ml' });
    expect(medidaDeContenido('3 de 110 g')).toEqual({ envase: 'paquete', porEnvase: 3, unidad: 'u.' });
    expect(medidaDeContenido('24 rollos')).toEqual({ envase: 'paquete', porEnvase: 24, unidad: 'rollos' });
    expect(medidaDeContenido('paquete de 100')).toEqual({ envase: 'paquete', porEnvase: 100, unidad: 'u.' });
    expect(medidaDeContenido(null)).toEqual({ envase: 'unidad', porEnvase: 1, unidad: 'u.' });
  });

  it('dice la cantidad con el envase y el total', () => {
    expect(textoDeCantidad(1, medidaDeContenido('quintal 46 kg'))).toBe('1 quintal · 46 kg');
    expect(textoDeCantidad(2, medidaDeContenido('maple de 30'))).toBe('2 maples · 60 u.');
    expect(textoDeCantidad(3, medidaDeContenido('900 ml'))).toBe('3 u. · 2,7 L');
    expect(textoDeCantidad(1.5, medidaDeContenido('arroba 11,5 kg'))).toBe('1,5 arrobas · 17,25 kg');
    expect(textoDeCantidad(2, medidaDeContenido('bidón 5 L'))).toBe('2 bidones · 10 L');
    expect(textoDeCantidad(12, medidaDeContenido(null))).toBe('12 u.');
  });

  it('lo agregado a mano: suelto, con envase conocido o sin saber cuánto trae', () => {
    const medida = (clave: string) => MEDIDAS_A_MANO.find((m) => m.clave === clave)!.medida;
    expect(textoDeCantidad(46, medida('kg'))).toBe('46 kg');
    expect(textoDeCantidad(2, medida('quintal'))).toBe('2 quintales · 92 kg');
    expect(textoDeCantidad(4, medida('paquete'))).toBe('4 paquetes');
    expect(textoDeCantidad(1, medida('unidad'))).toBe('1 u.');
  });

  it('explica la medida y lee lo que escribe la persona', () => {
    expect(equivalencia(medidaDeContenido('quintal 46 kg'))).toBe('1 quintal = 46 kg');
    expect(equivalencia(medidaDeContenido('900 ml'))).toBe('1 u. = 900 ml');
    expect(equivalencia(medidaDeContenido(null))).toBeNull();
    expect(leerCantidad('1,5')).toBe(1.5);
    expect(leerCantidad(' 3 ')).toBe(3);
    expect(leerCantidad('-2')).toBeNaN();
    expect(leerCantidad('dos')).toBeNaN();
  });
});

describe('las compras de Abasto entran solas', () => {
  it('un pedido ENTREGADO crea el artículo y su entrada, con el costo de lo que se pagó', () => {
    const r = comprasQueEntran([entregado], vacio(), AHORA);
    expect(r.articulos.map((a) => [a.id, a.nombre, a.detalle, a.origen])).toEqual([
      ['abasto:AB-101', 'Harina de trigo', 'quintal 46 kg', 'ABASTO'],
      ['abasto:AB-114', 'Huevo', 'maple de 30', 'ABASTO'],
    ]);
    expect(r.movimientos[0]).toMatchObject({ tipo: 'ENTRADA', cantidad: 2, costoUnitarioCentavos: 28500, claveUnica: claveDeCompra('p-1', 'AB-101', 'UNIDAD'), nota: 'Pedido A-0001' });
  });

  it('lo que todavía no llegó no entra', () => {
    expect(comprasQueEntran([enCamino], vacio(), AHORA).movimientos).toEqual([]);
  });

  it('sincronizar dos veces no duplica nada', async () => {
    const almacen = new AlmacenEnMemoria();
    expect(await sincronizarCompras(almacen, [entregado, enCamino], AHORA)).toBe(2);
    expect(await sincronizarCompras(almacen, [entregado, enCamino], AHORA)).toBe(0);
    const datos = await almacen.leer();
    expect(datos.movimientos).toHaveLength(2);
    expect(existencias(datos).find((e) => e.articulo.id === 'abasto:AB-101')!.texto).toBe('2 quintales · 92 kg');
  });

  it('cuando el pedido en camino se entrega, entra; y una segunda compra del mismo producto suma al mismo artículo', async () => {
    const almacen = new AlmacenEnMemoria();
    await sincronizarCompras(almacen, [entregado, enCamino], AHORA);
    const otraHarina: PedidoComprado = { id: 'p-3', codigo: 'A-0003', estado: 'ENTREGADO', lineas: [linea('AB-101', 'Harina de trigo · quintal 46 kg', 'Harinas y panificación', 1, 30000)] };
    expect(await sincronizarCompras(almacen, [{ ...enCamino, estado: 'ENTREGADO' }, otraHarina], AHORA)).toBe(2);
    const datos = await almacen.leer();
    expect(datos.articulos).toHaveLength(3);
    const harina = existencias(datos).find((e) => e.articulo.id === 'abasto:AB-101')!;
    expect(harina.cantidad).toBe(3);
    // Costo promedio ponderado: (2 × 285 + 1 × 300) / 3 = 290
    expect(harina.costoPromedioCentavos).toBe(29000);
    expect(harina.valorCentavos).toBe(87000);
  });

  it('los pedidos guardados antes del 01/11 (sin centavos en la línea) toman el costo del texto', () => {
    const viejo: PedidoComprado = { ...entregado, lineas: [{ ...entregado.lineas[0], subtotal: { texto: 'Bs 570,00' } }] };
    expect(comprasQueEntran([viejo], vacio(), AHORA).movimientos[0].costoUnitarioCentavos).toBe(28500);
    expect(centavosDeTexto('Bs 1.234,5')).toBe(123450);
    expect(centavosDeTexto('')).toBeNull();
  });
});

describe('a mano: otro proveedor y lo que se cuenta', () => {
  const kg = MEDIDAS_A_MANO.find((m) => m.clave === 'kg')!.medida;

  it('agrega un artículo de otro proveedor con su compra', () => {
    const queso = articuloAMano({ nombre: '  Queso   menonita ', medida: kg, proveedor: 'Feria Barrio Lindo' }, AHORA, 'a-1');
    expect(queso).toMatchObject({ nombre: 'Queso menonita', origen: 'OTRO_PROVEEDOR', clase: 'COMPRADO', proveedor: 'Feria Barrio Lindo' });
    const compra = entradaAMano(queso, 5, 3500, AHORA, 'm-1');
    const [e] = existencias({ articulos: [queso], movimientos: [compra] });
    expect(e.texto).toBe('5 kg');
    expect(e.valorCentavos).toBe(17500);
  });

  it('no deja agregar sin nombre ni con cantidades que no sirven', () => {
    expect(() => articuloAMano({ nombre: ' a ', medida: kg }, AHORA, 'x')).toThrow(ErrorDeInventario);
    const queso = articuloAMano({ nombre: 'Queso', medida: kg }, AHORA, 'a-1');
    expect(() => entradaAMano(queso, 0, null, AHORA, 'm')).toThrow('mayor a cero');
    expect(() => entradaAMano(queso, 2, -5, AHORA, 'm')).toThrow('precio');
  });

  it('el ajuste guarda la diferencia con lo contado, también hacia abajo', async () => {
    const almacen = new AlmacenEnMemoria();
    await sincronizarCompras(almacen, [entregado], AHORA);
    let harina = existencias(await almacen.leer()).find((e) => e.articulo.id === 'abasto:AB-101')!;
    const usado = ajusteAMano(harina, 0.5, AHORA, 'aj-1')!;
    expect(usado).toMatchObject({ tipo: 'AJUSTE', cantidad: -1.5, origen: 'MANUAL' });
    await almacen.guardar({ movimientos: [usado] });
    harina = existencias(await almacen.leer()).find((e) => e.articulo.id === 'abasto:AB-101')!;
    expect(harina.texto).toBe('0,5 quintales · 23 kg');
    expect(ajusteAMano(harina, 0.5, AHORA, 'aj-2')).toBeNull();
    expect(() => ajusteAMano(harina, -1, AHORA, 'aj-3')).toThrow('negativa');
  });

  it('lo que llega a cero queda como agotado y va al final', async () => {
    const almacen = new AlmacenEnMemoria();
    await sincronizarCompras(almacen, [entregado], AHORA);
    const huevo = existencias(await almacen.leer()).find((e) => e.articulo.id === 'abasto:AB-114')!;
    await almacen.guardar({ movimientos: [ajusteAMano(huevo, 0, AHORA, 'aj')!] });
    const [grupo] = inventarioDelNegocio({ tipo: 'tienda' }, await almacen.leer());
    expect(grupo.lineas.map((l) => [l.articulo.nombre, l.agotado])).toEqual([
      ['Harina de trigo', false],
      ['Huevo', true],
    ]);
  });
});

describe('el inventario según el tipo de cliente', () => {
  const datos = () => comprasQueEntran([entregado], vacio(), AHORA);

  it('hogar: su despensa', () => {
    const grupos = inventarioDelNegocio({ tipo: 'hogar' }, datos());
    expect(grupos.map((g) => g.titulo)).toEqual(['Tu despensa']);
    expect(grupos[0].lineas).toHaveLength(2);
  });

  it('tienda: para vender, con lo que vale', () => {
    const grupos = inventarioDelNegocio({ tipo: 'tienda' }, datos());
    expect(grupos.map((g) => g.clave)).toEqual(['para_vender']);
    expect(grupos[0].valorCentavos).toBe(57000 + 9150);
    expect(resumenDelInventario({ tipo: 'tienda' }, grupos)).toBe('2 productos · Bs 661,50 en mercadería');
  });

  it('productor: insumos y lo que hace, separados desde ya', () => {
    const grupos = inventarioDelNegocio({ tipo: 'productor', subtipo: 'salteneria' }, datos());
    expect(grupos.map((g) => g.clave)).toEqual(['insumos', 'hechos']);
    expect(grupos[0].lineas).toHaveLength(2);
    expect(grupos[1].lineas).toEqual([]);
    expect(grupos[1].vacio).toContain('tus salteñas');
  });

  it('lo hecho no se mezcla con los insumos', () => {
    const d = datos();
    const salteña = articuloAMano({ nombre: 'Salteña de pollo', medida: MEDIDAS_A_MANO[0].medida, clase: 'HECHO' }, AHORA, 'h-1');
    const grupos = inventarioDelNegocio({ tipo: 'productor', subtipo: 'salteneria' }, { articulos: [...d.articulos, salteña], movimientos: d.movimientos });
    expect(grupos[1].lineas.map((l) => l.articulo.nombre)).toEqual(['Salteña de pollo']);
    expect(grupos[0].lineas.map((l) => l.articulo.nombre)).not.toContain('Salteña de pollo');
  });

  it('sin compras todavía: sin resumen y con el texto del estado vacío', () => {
    const grupos = inventarioDelNegocio({ tipo: 'hogar' }, vacio());
    expect(resumenDelInventario({ tipo: 'hogar' }, grupos)).toBeNull();
    expect(grupos[0].vacio).toContain('aparece aquí solo');
  });
});
