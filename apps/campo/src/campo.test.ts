import { BandejaCampo, type Almacen, type Enviar, type OperacionLocal } from './bandeja';
import { leerPrecio } from './precio';

class AlmacenEnMemoria implements Almacen {
  private readonly ops = new Map<string, OperacionLocal>();
  async guardar(op: OperacionLocal) {
    this.ops.set(op.clave, { ...op });
  }
  async todas() {
    return [...this.ops.values()];
  }
}

const shampoo = { nombre: 'Shampoo 400 ml', rubro: 'Higiene', presentacion: 'CAJA' as const, unidades: 48, precioUnitarioCentavos: 1800 };
let n = 0;
const clave = () => `clave-${++n}`;

describe('Bandeja de Campo', () => {
  it('sin señal guarda todo con la misma clave para el próximo intento', async () => {
    const enviadas: string[] = [];
    const sinSenal: Enviar = async (ops) => {
      enviadas.push(...ops.map((o) => o.clave));
      throw new Error('Network request failed');
    };
    const bandeja = new BandejaCampo(new AlmacenEnMemoria(), sinSenal, clave);
    const op = await bandeja.agregar(shampoo);
    await bandeja.subir();
    await bandeja.subir();
    expect(enviadas).toEqual([op.clave, op.clave]);
    expect((await bandeja.porSubir())[0].intentos).toBe(2);
  });

  it('al volver la señal sube y vacía la bandeja', async () => {
    const conSenal: Enviar = async (ops) => ops.map((o) => ({ clave: o.clave, estado: 'aplicada' as const }));
    const bandeja = new BandejaCampo(new AlmacenEnMemoria(), conSenal, clave);
    await bandeja.agregar(shampoo);
    await bandeja.agregar({ ...shampoo, nombre: 'Jabón 110 g' });
    expect(await bandeja.subir()).toEqual({ subidos: 2, pendientes: 0 });
    expect(await bandeja.porSubir()).toEqual([]);
  });
});

describe('Precio del cartel', () => {
  it.each([
    ['Shampoo 400ml Bs 18,50', 1850],
    ['OFERTA 18.50', 1850],
    ['Bs.18', 1800],
    ['caja 48 u. 860 bs', 86000],
  ])('lee «%s»', (texto, centavos) => expect(leerPrecio(texto)).toBe(centavos));

  it('si no hay precio claro devuelve null', () => {
    expect(leerPrecio('Shampoo 400 ml')).toBeNull();
  });
});
