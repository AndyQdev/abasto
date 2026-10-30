import { describe, expect, it } from 'vitest';
import type { Mayorista, Producto } from './catalogo';
import { fechaCorta, frenteAlSuper, vitrinas } from './vitrinas';

const dinero = (centavos: number) => ({ centavos, texto: `Bs ${(centavos / 100).toFixed(2).replace('.', ',')}` });
const abasto: Mayorista = { id: 'abasto', nombre: 'Abasto', ciudad: 'Santa Cruz', verificado: true, relacion: 'NINGUNA', deLaCasa: true };
const afiliado: Mayorista = { ...abasto, id: 'lp', nombre: 'Distribuidora Los Pozos', deLaCasa: false, relacion: 'APROBADA' };

function producto(id: string, chica: [number, number], grande: [number, number], superBs: number | null, marca: string, boliviana: boolean, mayorista = abasto): Producto {
  return {
    id,
    codigo: id,
    nombre: id,
    rubro: 'Abarrotes',
    descripcion: '',
    stock: 0,
    estado: 'ACTIVO',
    precioVisible: true,
    abastecimiento: 'BAJO_PEDIDO',
    entregaHoras: 24,
    mayorista,
    escalas: [
      { presentacion: chica[0] === 1 ? 'UNIDAD' : 'DOCENA', cantidad: chica[0], precioUnitario: dinero(chica[1]) },
      { presentacion: 'CAJA', cantidad: grande[0], precioUnitario: dinero(grande[1]) },
    ],
    marca,
    marcaBoliviana: boliviana,
    precioEnSuper: superBs === null ? null : { precio: dinero(superBs), donde: id === 'para-ti' ? 'Amarket' : 'Fidalga', fecha: '2026-10-30' },
  };
}

const aceite = producto('aceite', [1, 1750], [12, 1670], 1900, 'Fino', true);
const azucar = producto('azucar', [12, 700], [24, 650], 760, 'Guabirá', true);
const elite = producto('elite', [1, 7800], [4, 7030], 8474, 'Elite', false);
const paraTi = producto('para-ti', [1, 3560], [12, 3210], 3870, 'Para Ti', true);
const sinSuper = producto('sin-super', [12, 500], [24, 450], null, 'Otra', false);
const ajeno = producto('ajeno', [12, 100], [24, 90], 5000, 'PIL', true, afiliado);
const todos = [aceite, azucar, elite, paraTi, sinSuper, ajeno];
const vitrina = (clave: string) => vitrinas(todos).find((v) => v.clave === clave)!;

describe('vitrinas del Inicio', () => {
  it('más barato que en el súper: del mayor descuento al menor, con el precio del súper tachado y la fuente', () => {
    const v = vitrina('super');
    expect(v.subtitulo).toBe('Comparado con Fidalga y Amarket · precios del 30/10/2026');
    expect(v.tarjetas.map((t) => t.producto.id)).toEqual(['para-ti', 'elite', 'azucar', 'aceite']);
    expect(v.tarjetas[1]).toMatchObject({ precio: 'Bs 70,30', detalle: 'c/u llevando 4', gancho: '-17 %', tachado: 'Bs 84,74 en el súper' });
  });

  it('gana revendiendo: la ganancia por unidad, por la presentación grande y sobre lo que paga', () => {
    const t = vitrina('reventa').tarjetas.find((x) => x.producto.id === 'aceite')!;
    expect(t).toMatchObject({ precio: '+Bs 2,30', detalle: 'c/u · Bs 27,60 por 12', gancho: 'Ganas 14 %' });
  });

  it('lo que ya encabeza una vitrina pasa al final en las siguientes', () => {
    // El súper muestra adelante a Para Ti, Elite y Guabirá: la reventa empieza por el Aceite
    expect(vitrina('reventa').tarjetas.map((t) => t.producto.id)).toEqual(['aceite', 'para-ti', 'elite', 'azucar']);
  });

  it('pruébalo con poco: lo más barato de pedir la primera vez, primero', () => {
    const v = vitrinas([aceite, azucar, elite, paraTi, sinSuper]).find((x) => x.clave === 'probar')!;
    expect(v.tarjetas.find((t) => t.producto.id === 'aceite')).toMatchObject({ precio: 'Bs 17,50', detalle: 'por 1 unidad', gancho: 'Sin mínimo' });
    expect(v.tarjetas.find((t) => t.producto.id === 'azucar')).toMatchObject({ precio: 'Bs 84,00', detalle: 'por una docena', gancho: 'Mínimo 12 u.' });
    // Todo lo demás ya estaba al frente de otra vitrina: arranca por el que no se vio
    expect(v.tarjetas[0].producto.id).toBe('sin-super');
  });

  it('más llevas, más ahorras: el ahorro en Bs de llevar la caja', () => {
    const t = vitrina('volumen').tarjetas.find((x) => x.producto.id === 'para-ti')!;
    expect(t).toMatchObject({ gancho: 'Ahorras Bs 42,00', tachado: 'Bs 35,60 c/u' });
  });

  it('marcas de aquí: solo las bolivianas de Abasto', () => {
    const v = vitrina('deAqui');
    expect(v.tarjetas.map((t) => t.producto.id).sort()).toEqual(['aceite', 'azucar', 'para-ti']);
    expect(v.subtitulo).toBe('Bolivianas: Guabirá, Fino, Para Ti y más');
  });

  it('a los afiliados nunca se los ordena por precio, y una vitrina con menos de 3 no se muestra', () => {
    expect(vitrinas(todos).flatMap((v) => v.tarjetas).some((t) => t.producto.id === 'ajeno')).toBe(false);
    expect(vitrinas([aceite, azucar]).map((v) => v.clave)).toEqual([]);
  });

  it('frente al súper y la fecha corta', () => {
    expect(frenteAlSuper(aceite, aceite.escalas[1])).toMatchObject({ porcentaje: 12, gananciaPorUnidad: 230, fecha: '30/10/2026', donde: 'Fidalga' });
    expect(frenteAlSuper(sinSuper, sinSuper.escalas[1])).toBeNull();
    expect(fechaCorta('2026-10-30')).toBe('30/10/2026');
  });
});
