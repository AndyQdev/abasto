import { describe, expect, it } from 'vitest';
import type { Producto } from '../catalogo';
import { comprasQueEntran, type PedidoComprado } from './compras';
import { anotarFiado, clienteDeFiado, saldosDeFiado, totalFiado } from './fiado';
import { ahorroFrenteAlSuper, anotacion, cuentasDelMes, itemDeLista, listaVigente, seTeAcaba } from './hogar';
import { MEDIDAS_A_MANO } from './medidas';
import { cuantosCambios, datosVacios, fusionar, type DatosDeNegocio } from './modelo';
import { ajusteAMano, articuloAMano, entradaAMano, existencias } from './motor';
import { itemsParaPedir } from './pedir';
import { aEnvases, articuloHecho, costoDeReceta, planificar, receta, registrarTanda, textoDeReceta } from './produccion';
import { nombreDelMes, otroMes, reporteDelMes } from './reporte';
import { avisoDeStock, conMinimo, conPrecio, precioDeVenta, precioSugerido, registrarVenta } from './ventas';

const HOY = '2026-11-01T12:00:00.000Z';
const linea = (id: string, nombre: string, rubro: string, unidades: number, centavos: number) => ({
  presentacion: 'UNIDAD',
  cantidad: unidades,
  unidades,
  producto: { id, nombre, rubro },
  subtotal: { texto: '', centavos },
});

/** Una tienda con 12 Coca-Colas (Bs 10,50 c/u) y 2 quintales de harina (Bs 285 c/u) entregados */
function conCompras(): DatosDeNegocio {
  const pedido: PedidoComprado = {
    id: 'p-1',
    codigo: 'A-1',
    estado: 'ENTREGADO',
    total: { centavos: 12600 + 57000 },
    lineas: [linea('AB-030', 'Coca-Cola 2 L', 'Bebidas', 12, 12600), linea('AB-101', 'Harina de trigo · quintal 46 kg', 'Harinas y panificación', 2, 57000)],
  };
  return fusionar(datosVacios(), comprasQueEntran([pedido], datosVacios(), HOY));
}

describe('fusionar: la misma regla en el teléfono y en el servidor', () => {
  it('lo que solo se agrega entra una vez; lo editable gana si es más nuevo', () => {
    const d = conCompras();
    const otraVez = fusionar(d, { movimientos: d.movimientos, articulos: d.articulos });
    expect(otraVez.movimientos).toHaveLength(2);
    const coca = d.articulos.find((a) => a.productoId === 'AB-030')!;
    const viejo = fusionar(otraVez, { articulos: [{ ...coca, nombre: 'Viejo', actualizadoEn: '2020-01-01T00:00:00.000Z' }] });
    expect(viejo.articulos.find((a) => a.id === coca.id)!.nombre).toBe('Coca-Cola');
    const nuevo = fusionar(otraVez, { articulos: [{ ...coca, nombre: 'Coca-Cola grande', actualizadoEn: '2026-11-02T00:00:00.000Z' }] });
    expect(nuevo.articulos.find((a) => a.id === coca.id)!.nombre).toBe('Coca-Cola grande');
    expect(cuantosCambios({ articulos: d.articulos, movimientos: d.movimientos })).toBe(4);
  });

  it('un artículo eliminado viaja y deja de verse en las existencias', () => {
    const d = conCompras();
    const coca = d.articulos.find((a) => a.productoId === 'AB-030')!;
    const sinCoca = fusionar(d, { articulos: [{ ...coca, eliminado: true, actualizadoEn: '2026-11-02T00:00:00.000Z' }] });
    expect(existencias(sinCoca).map((x) => x.articulo.nombre)).toEqual(['Harina de trigo']);
  });

  it('el pedido entregado también deja su gasto, una sola vez', () => {
    const d = conCompras();
    expect(d.anotaciones).toEqual([expect.objectContaining({ tipo: 'GASTO', origen: 'ABASTO', montoCentavos: 69600, claveUnica: 'pedido:p-1' })]);
    expect(comprasQueEntran([{ id: 'p-1', codigo: 'A-1', estado: 'ENTREGADO', total: { centavos: 69600 }, lineas: [] }], d, HOY).anotaciones).toEqual([]);
  });
});

describe('tienda: precio, poco stock y caja', () => {
  const tienda = { tipo: 'tienda' } as const;

  it('el precio sugerido suma el margen y redondea a 50 centavos', () => {
    expect(precioSugerido(1050, 0.2)).toBe(1300);
    expect(precioSugerido(1000, 0.2)).toBe(1200);
    const coca = existencias(conCompras()).find((x) => x.articulo.productoId === 'AB-030')!;
    expect(precioDeVenta(coca, tienda)).toEqual({ centavos: 1300, sugerido: true, gananciaCentavos: 250 });
    const conSuPrecio = { ...coca, articulo: conPrecio(coca.articulo, 1400, HOY) };
    expect(precioDeVenta(conSuPrecio, tienda)).toEqual({ centavos: 1400, sugerido: false, gananciaCentavos: 350 });
    // El productor suma su trabajo: 50 %
    expect(precioDeVenta(coca, { tipo: 'productor', subtipo: 'salteneria' })!.centavos).toBe(1600);
  });

  it('vender descuenta, guarda el costo de ese momento y no deja vender más de lo que hay', () => {
    const d = conCompras();
    const coca = d.articulos.find((a) => a.productoId === 'AB-030')!;
    const r = registrarVenta(d, [{ articuloId: coca.id, cantidad: 3, precioUnitarioCentavos: 1300 }], { forma: 'CONTADO' }, HOY, 'v-1');
    expect(r.venta).toMatchObject({ totalCentavos: 3900, costoCentavos: 3150, forma: 'CONTADO' });
    expect(r.movimientos).toEqual([expect.objectContaining({ tipo: 'VENTA', cantidad: -3, ventaId: 'v-1' })]);
    expect(r.fiado).toBeNull();
    const despues = fusionar(d, { movimientos: r.movimientos, ventas: [r.venta] });
    expect(existencias(despues).find((x) => x.articulo.id === coca.id)!.texto).toBe('9 u. · 18 L');
    expect(() => registrarVenta(despues, [{ articuloId: coca.id, cantidad: 10, precioUnitarioCentavos: 1300 }], { forma: 'CONTADO' }, HOY, 'v-2')).toThrow('Solo tienes 9 u.');
    expect(() => registrarVenta(d, [], { forma: 'CONTADO' }, HOY, 'v-3')).toThrow('Agrega lo que vendiste');
  });

  it('«queda poco»: con el mínimo que puso la persona o con la cuarta parte de la última compra', () => {
    const d = conCompras();
    const coca = d.articulos.find((a) => a.productoId === 'AB-030')!;
    const x = (datos: DatosDeNegocio) => existencias(datos).find((e) => e.articulo.id === coca.id)!;
    expect(avisoDeStock(x(d), d)).toBeNull();
    const quedan3 = fusionar(d, { movimientos: [ajusteAMano(x(d), 3, HOY, 'aj-1')!] });
    expect(avisoDeStock(x(quedan3), quedan3)).toBe('poco');
    const conMin = fusionar(quedan3, { articulos: [conMinimo(coca, 2, '2026-11-02T00:00:00.000Z')] });
    expect(avisoDeStock(x(conMin), conMin)).toBeNull();
    const cero = fusionar(d, { movimientos: [ajusteAMano(x(d), 0, HOY, 'aj-2')!] });
    expect(avisoDeStock(x(cero), cero)).toBe('agotado');
  });

  it('pedir de nuevo arma el carrito con la presentación del catálogo, redondeando hacia arriba', () => {
    const producto = { id: 'AB-030', estado: 'ACTIVO', precioVisible: true, nombre: 'Coca-Cola 2 L', mayorista: { id: 'abasto', nombre: 'Abasto' }, escalas: [{ presentacion: 'CAJA', cantidad: 6, precioUnitario: { centavos: 1050, texto: '' } }] } as unknown as Producto;
    const r = itemsParaPedir([{ productoId: 'AB-030', envases: 10 }, { productoId: 'NO-HAY', envases: 1 }], [producto], (id) => (id === 'NO-HAY' ? 'Algo viejo' : id));
    expect(r.items).toEqual([expect.objectContaining({ productoId: 'AB-030', presentacion: 'CAJA', cantidad: 2 })]);
    expect(r.noSeVenden).toEqual(['Algo viejo']);
  });
});

describe('fiado y el mes', () => {
  it('una venta fiada queda en el cuaderno; los pagos la bajan', () => {
    const d = conCompras();
    const coca = d.articulos.find((a) => a.productoId === 'AB-030')!;
    const pedro = clienteDeFiado('  Don   Pedro ', '7 123-4567', HOY, 'c-1');
    expect(pedro).toMatchObject({ nombre: 'Don Pedro', telefono: '71234567' });
    expect(() => registrarVenta(d, [{ articuloId: coca.id, cantidad: 2, precioUnitarioCentavos: 1300 }], { forma: 'FIADO' }, HOY, 'v')).toThrow('a quién');
    const r = registrarVenta(d, [{ articuloId: coca.id, cantidad: 2, precioUnitarioCentavos: 1300 }], { forma: 'FIADO', cliente: pedro }, HOY, 'v-1');
    expect(r.fiado).toMatchObject({ tipo: 'DEBE', montoCentavos: 2600, clienteId: 'c-1' });
    const pago = anotarFiado(pedro, 'PAGA', 1000, null, '2026-11-03T00:00:00.000Z', 'f-2');
    const saldos = saldosDeFiado({ clientes: [pedro], fiados: [r.fiado!, pago] });
    expect(saldos[0]).toMatchObject({ saldoCentavos: 1600, debeDesde: HOY });
    expect(totalFiado(saldos)).toBe(1600);
    expect(() => anotarFiado(pedro, 'PAGA', 0, null, HOY, 'x')).toThrow('monto');
  });

  it('el mes: vendí, me costó, gané, gastos y me quedó', () => {
    const d = conCompras();
    const coca = d.articulos.find((a) => a.productoId === 'AB-030')!;
    const v1 = registrarVenta(d, [{ articuloId: coca.id, cantidad: 4, precioUnitarioCentavos: 1300 }], { forma: 'CONTADO' }, HOY, 'v-1');
    const luz = anotacion('GASTO', 1500, 'Servicios', 'Luz', HOY, 'g-1');
    const r = reporteDelMes({ ventas: [v1.venta], anotaciones: [...d.anotaciones, luz] }, '2026-11');
    expect(r).toMatchObject({ ventas: 1, ventasCentavos: 5200, costoCentavos: 4200, gananciaBrutaCentavos: 1000, gastosCentavos: 1500, gananciaNetaCentavos: -500 });
    expect(r.masVendidos[0]).toMatchObject({ articuloId: coca.id, cantidad: 4, gananciaCentavos: 1000 });
    expect(nombreDelMes('2026-11')).toBe('noviembre 2026');
    expect(otroMes('2026-01', -1)).toBe('2025-12');
  });
});

describe('productor: receta, costo, planificador y tanda', () => {
  function salteneria() {
    const d = conCompras();
    const harina = d.articulos.find((a) => a.productoId === 'AB-101')!;
    const kg = MEDIDAS_A_MANO.find((m) => m.clave === 'kg')!.medida;
    const papa = articuloAMano({ nombre: 'Papa', medida: kg }, HOY, 'papa');
    const salteña = articuloHecho('Salteña de pollo', HOY, 'saltena');
    const r = receta({ id: 'r-1', articuloId: salteña.id, nombre: 'Salteña de pollo', rinde: 100, insumos: [{ articuloId: harina.id, cantidad: 5 }, { articuloId: papa.id, cantidad: 4 }] }, HOY);
    const datos = fusionar(d, { articulos: [papa, salteña], movimientos: [entradaAMano(papa, 10, 600, HOY, 'm-papa')], recetas: [r] });
    return { datos, r, harina, papa, salteña };
  }

  it('la receta se escribe en kg aunque la harina se compre por quintal', () => {
    const { harina } = salteneria();
    expect(textoDeReceta(harina, 5)).toBe('5 kg');
    expect(aEnvases(harina, 46)).toBe(1);
  });

  it('el costo por salteña sale de los insumos y su precio promedio', () => {
    const { datos, r } = salteneria();
    // 5 kg de harina (Bs 285 / 46 kg) + 4 kg de papa (Bs 6/kg) = 30,98 + 24 = Bs 54,98 → Bs 0,55 por salteña
    expect(costoDeReceta(r, datos)).toEqual({ totalCentavos: 5498, porUnidadCentavos: 55, sinCosto: [] });
  });

  it('planificar 300: lo que hace falta y lo que falta comprar', () => {
    const { datos, r } = salteneria();
    const plan = planificar(r, 300, datos);
    expect(plan.insumos.map((i) => [i.articulo.nombre, i.textoNecesita, i.textoFalta])).toEqual([
      ['Harina de trigo', '15 kg', null],
      ['Papa', '12 kg', '2 kg'],
    ]);
    expect(plan.alcanza).toBe(false);
    expect(() => registrarTanda(r, datos, 300, 290, HOY, 't-1')).toThrow('Te falta 2 kg de Papa');
  });

  it('registrar la tanda descuenta los insumos y suma lo hecho con su costo', () => {
    const { datos, r, harina, papa, salteña } = salteneria();
    const t = registrarTanda(r, datos, 200, 190, HOY, 't-1');
    expect(t.tanda).toMatchObject({ planificado: 200, obtenido: 190, costoTotalCentavos: 10996 });
    const despues = fusionar(datos, { movimientos: t.movimientos, tandas: [t.tanda] });
    const x = (id: string) => existencias(despues).find((e) => e.articulo.id === id)!;
    expect(x(harina.id).texto).toBe('1,78 quintales · 82 kg');
    expect(x(papa.id).texto).toBe('2 kg');
    expect(x(salteña.id)).toMatchObject({ cantidad: 190, costoPromedioCentavos: 58 });
    // Lo hecho se vende con la caja, con el margen del productor
    const v = registrarVenta(despues, [{ articuloId: salteña.id, cantidad: 50, precioUnitarioCentavos: 600 }], { forma: 'CONTADO' }, HOY, 'v-1');
    expect(v.venta).toMatchObject({ totalCentavos: 30000, costoCentavos: 2900 });
  });

  it('una receta sin insumos o que se usa a sí misma no se guarda', () => {
    expect(() => receta({ id: 'r', articuloId: 'a', nombre: 'Pan', rinde: 50, insumos: [] }, HOY)).toThrow('al menos un insumo');
    expect(() => receta({ id: 'r', articuloId: 'a', nombre: 'Pan', rinde: 50, insumos: [{ articuloId: 'a', cantidad: 1 }] }, HOY)).toThrow('propia receta');
    expect(() => receta({ id: 'r', articuloId: 'a', nombre: 'Pan', rinde: 0, insumos: [{ articuloId: 'b', cantidad: 1 }] }, HOY)).toThrow('Cuántas');
  });
});

describe('hogar: cuentas, se te acaba, lista y súper', () => {
  it('las cuentas del mes: lo de Abasto entra solo como gasto', () => {
    const d = conCompras();
    const sueldo = anotacion('INGRESO', 300000, 'Sueldo', null, HOY, 'i-1');
    const pasaje = anotacion('GASTO', 2000, 'Transporte', null, HOY, 'g-1');
    const c = cuentasDelMes([...d.anotaciones, sueldo, pasaje], '2026-11');
    expect(c).toMatchObject({ ingresosCentavos: 300000, gastosCentavos: 71600, quedanCentavos: 228400 });
    expect(c.porCategoria[0]).toEqual({ categoria: 'Compras en Abasto', centavos: 69600 });
    expect(() => anotacion('GASTO', -5, 'Comida', null, HOY, 'x')).toThrow('monto');
  });

  it('«se te acaba»: con lo que se usó por día; sin datos, no inventa', () => {
    const d = conCompras();
    const harina = existencias(d).find((x) => x.articulo.productoId === 'AB-101')!;
    expect(seTeAcaba(harina, d.movimientos, HOY)).toBeNull();
    // En 10 días se usó 1 quintal: queda 1, se acaba en ~10 días
    const usado = ajusteAMano(harina, 1, '2026-11-11T12:00:00.000Z', 'aj')!;
    const despues = fusionar(d, { movimientos: [usado] });
    const x = existencias(despues).find((e) => e.articulo.productoId === 'AB-101')!;
    expect(seTeAcaba(x, despues.movimientos, '2026-11-11T12:00:00.000Z')).toBe(10);
  });

  it('la lista fija y el ahorro frente al súper', () => {
    const a = itemDeLista('AB-030', 'UNIDAD', 6, HOY, 'l-1');
    expect(listaVigente([a, { ...itemDeLista('AB-007', 'UNIDAD', 1, HOY, 'l-2'), eliminado: true }])).toEqual([a]);
    const productos = [{ id: 'AB-030', precioEnSuper: { precio: { centavos: 1300, texto: '' }, donde: 'Fidalga', fecha: '2026-10-30' } }] as unknown as Producto[];
    const pedido: PedidoComprado = { id: 'p', codigo: 'A', estado: 'ENTREGADO', lineas: [linea('AB-030', 'Coca-Cola 2 L', 'Bebidas', 12, 12600)] };
    expect(ahorroFrenteAlSuper([pedido], productos)).toEqual({ ahorroCentavos: 3000, lineasComparadas: 1 });
  });
});
