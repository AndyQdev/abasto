import { describe, expect, it } from 'vitest';
import {
  comprables,
  disponible,
  escalaPorDefecto,
  filtrar,
  filtrarMayoristas,
  iniciales,
  itemDeCarrito,
  nombreCorto,
  opcionesDeCompra,
  ordenarMayoristas,
  precioDesde,
  rubros,
  textoDeStock,
  type Mayorista,
  type Producto,
} from './catalogo';
import { cantidadDe } from './carrito';

const dinero = (centavos: number) => ({ centavos, texto: `Bs ${(centavos / 100).toFixed(2).replace('.', ',')}` });

const losPozos: Mayorista = { id: 'lp', nombre: 'Distribuidora Los Pozos', ciudad: 'Santa Cruz', verificado: true, relacion: 'APROBADA', deLaCasa: false };
const laRamada: Mayorista = { id: 'lr', nombre: 'Importadora La Ramada', ciudad: 'Santa Cruz', verificado: true, relacion: 'NINGUNA', deLaCasa: false };

function producto(parcial: Partial<Producto> & Pick<Producto, 'id' | 'nombre'>): Producto {
  return {
    codigo: parcial.id,
    rubro: 'Higiene y cuidado personal',
    descripcion: '',
    stock: 312,
    estado: 'ACTIVO',
    precioVisible: true,
    abastecimiento: 'STOCK',
    entregaHoras: null,
    mayorista: losPozos,
    escalas: [
      { presentacion: 'CAJA', cantidad: 48, precioUnitario: dinero(1800) },
      { presentacion: 'CUARTA', cantidad: 3, precioUnitario: dinero(2200) },
      { presentacion: 'DOCENA', cantidad: 12, precioUnitario: dinero(2000) },
    ],
    ...parcial,
  };
}

const shampoo = producto({ id: 'HP-0400', nombre: 'Shampoo 400 ml' });
// Red privada: Catálogo no manda precios a una tienda que La Ramada no aprobó
const shampooAjeno = producto({
  id: 'LR-SH400',
  nombre: 'Shampoo 400 ml · Hidratante',
  mayorista: laRamada,
  precioVisible: false,
  escalas: [
    { presentacion: 'CUARTA', cantidad: 3, precioUnitario: null },
    { presentacion: 'DOCENA', cantidad: 12, precioUnitario: null },
  ],
});
const papel = producto({ id: 'LP-0004', nombre: 'Papel higiénico 4 rollos', rubro: 'Limpieza del hogar' });
const pausado = producto({ id: 'LD-2000', nombre: 'Detergente líquido 2 L', estado: 'PAUSADO' });
const enRevision = producto({ id: 'HP-0420', nombre: 'Shampoo infantil', estado: 'PENDIENTE_DE_REVISION' });

describe('nombres de mayoristas', () => {
  it('saca el tipo de negocio para el nombre corto', () => {
    expect(nombreCorto('Distribuidora Los Pozos')).toBe('Los Pozos');
    expect(nombreCorto('Importadora La Ramada')).toBe('La Ramada');
    expect(nombreCorto('Mayorista Central')).toBe('Central');
  });

  it('arma las iniciales como en la maqueta', () => {
    expect(iniciales('Distribuidora Los Pozos')).toBe('LP');
    expect(iniciales('Comercial 7 Calles')).toBe('7C');
    expect(iniciales('Mayorista Central')).toBe('MC');
  });
});

describe('precios por volumen', () => {
  it('ordena las escalas de la más chica a la más grande y calcula el ahorro contra la cuarta', () => {
    const opciones = opcionesDeCompra(shampoo);
    expect(opciones.map((o) => o.nombre)).toEqual(['Cuarta', 'Docena', 'Caja 48']);
    expect(opciones.map((o) => o.ahorro)).toEqual(['Precio base', 'Ahorras 9 %', 'Ahorras 18 %']);
    expect(opciones[2].totalCentavos).toBe(1800 * 48);
  });

  it('sin relación aprobada no hay opciones, precio «desde» ni escala para agregar', () => {
    expect(opcionesDeCompra(shampooAjeno)).toEqual([]);
    expect(precioDesde(shampooAjeno)).toBeNull();
    expect(escalaPorDefecto(shampooAjeno)).toBeNull();
  });

  it('el precio «desde» es el de la caja y desde una lista se agrega una docena', () => {
    expect(precioDesde(shampoo)?.presentacion).toBe('CAJA');
    expect(escalaPorDefecto(shampoo)?.presentacion).toBe('DOCENA');
  });

  it('el ítem del carrito guarda el precio que vio la tienda', () => {
    const item = itemDeCarrito(shampoo, escalaPorDefecto(shampoo)!, 2);
    expect(item).toMatchObject({ presentacion: 'DOCENA', cantidad: 2, unidadesPorPresentacion: 12, precioUnitarioCentavos: 2000, mayoristaId: 'lp' });
  });

  it('escribe las cantidades con su presentación', () => {
    expect(cantidadDe('DOCENA', 1)).toBe('1 docena');
    expect(cantidadDe('CAJA', 3)).toBe('3 cajas');
  });
});

describe('búsqueda sobre el catálogo guardado', () => {
  const todos = [shampoo, shampooAjeno, papel, pausado, enRevision];

  it('no muestra productos pausados ni en revisión', () => {
    expect(comprables(todos).map((p) => p.id)).toEqual(['HP-0400', 'LR-SH400', 'LP-0004']);
  });

  it('ignora tildes y mayúsculas y busca también por mayorista', () => {
    expect(filtrar(todos, { texto: 'HIGIENICO' }).map((p) => p.id)).toEqual(['LP-0004']);
    expect(filtrar(todos, { texto: 'ramada' }).map((p) => p.id)).toEqual(['LR-SH400']);
    expect(filtrar(todos, { texto: 'shampoo 400' })).toHaveLength(2);
  });

  it('filtra por rubro y por mayorista', () => {
    expect(filtrar(todos, { rubro: 'Limpieza del hogar' }).map((p) => p.id)).toEqual(['LP-0004']);
    expect(filtrar(todos, { mayoristaId: 'lr' }).map((p) => p.id)).toEqual(['LR-SH400']);
  });

  it('lista los rubros sin repetir', () => {
    expect(rubros(todos)).toEqual(['Higiene y cuidado personal', 'Limpieza del hogar']);
  });

  it('busca mayoristas por nombre', () => {
    expect(filtrarMayoristas([losPozos, laRamada], 'pozos').map((m) => m.id)).toEqual(['lp']);
  });
});

describe('mayoristas', () => {
  it('primero los que ya me venden; nunca se ordena por precio', () => {
    const central: Mayorista = { id: 'mc', nombre: 'Mayorista Central', ciudad: 'Santa Cruz', verificado: true, relacion: 'SOLICITADA', deLaCasa: false };
    expect(ordenarMayoristas([laRamada, central, losPozos]).map((m) => m.id)).toEqual(['lp', 'mc', 'lr']);
  });
});

describe('stock', () => {
  it('lo dice con palabras', () => {
    expect(textoDeStock({ stock: 0, estado: 'SIN_STOCK', abastecimiento: 'STOCK', entregaHoras: null }).texto).toBe('Sin stock');
    expect(textoDeStock({ stock: 40, estado: 'ACTIVO', abastecimiento: 'STOCK', entregaHoras: null }).texto).toBe('Quedan 40 u.');
    expect(textoDeStock({ stock: 312, estado: 'ACTIVO', abastecimiento: 'STOCK', entregaHoras: null }).texto).toBe('Hay stock');
  });
});

describe('Abasto vende (vendedor de la casa, bajo pedido)', () => {
  const abasto: Mayorista = { id: 'abasto', nombre: 'Abasto', ciudad: 'Santa Cruz', verificado: true, relacion: 'NINGUNA', deLaCasa: true };
  const arroz = producto({ id: 'AB-001', nombre: 'Arroz grano largo 1 kg', mayorista: abasto, stock: 0, abastecimiento: 'BAJO_PEDIDO', entregaHoras: 24 });

  it('bajo pedido se puede comprar con stock 0 y dice cuándo llega', () => {
    expect(disponible(arroz)).toBe(true);
    expect(textoDeStock(arroz)).toEqual({ texto: 'Llega en 24 h', clase: 'ins-verde' });
    expect(escalaPorDefecto(arroz)?.presentacion).toBe('DOCENA');
  });

  it('con stock 0 y sin ser bajo pedido, no se puede comprar', () => {
    expect(disponible({ ...shampoo, stock: 0 })).toBe(false);
  });

  it('Abasto aparece primero entre los mayoristas', () => {
    expect(ordenarMayoristas([laRamada, losPozos, abasto]).map((m) => m.id)).toEqual(['abasto', 'lp', 'lr']);
  });
});
