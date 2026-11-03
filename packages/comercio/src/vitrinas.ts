/**
 * Las vitrinas del Inicio (31/10, idea del usuario a partir de Alibaba): estantes armados por el motivo para
 * comprar, no por el tipo de producto. Cada una trabaja una palanca distinta y sale de datos reales:
 * - super: el precio del supermercado como ancla («~~Bs 19,00 en el súper~~ Bs 16,70 c/u»).
 * - reventa: el precio contado como ganancia para la tienda.
 * - probar: lo que se puede pedir de a poco la primera vez.
 * - volumen: el ahorro en Bs de llevar la caja o el fardo.
 * - deAqui: las marcas bolivianas (verificadas en Catálogo).
 * Solo entra lo que vende Abasto: a los mayoristas afiliados nunca se los ordena por precio (red privada).
 */
import { bs } from './carrito';
import { escalasConPrecio, preciosDeLaCasa, type Escala, type Producto } from './catalogo';

/** Las de siempre y, desde el 01/11, las de cada negocio (`negocios.ts`) */
export type ClaveDeVitrina = 'super' | 'reventa' | 'probar' | 'volumen' | 'deAqui' | 'repone' | 'descartables' | 'receta' | 'rubro' | 'sugeridos' | 'despensa' | 'casa';

export interface TarjetaDeVitrina {
  producto: Producto;
  /** El número grande de la tarjeta */
  precio: string;
  /** Lo que lo explica, debajo («c/u llevando 24») */
  detalle: string;
  /** La etiqueta que vende en esta vitrina («-12 %», «Ahorras Bs 33,60», «PIL») */
  gancho: string;
  /** Un precio tachado para comparar (el del súper o el de comprar de a poco). Null si no hay */
  tachado: string | null;
}

export interface Vitrina {
  clave: ClaveDeVitrina;
  titulo: string;
  subtitulo: string;
  tarjetas: TarjetaDeVitrina[];
}

/** Una vitrina con menos productos que esto no se muestra: un estante casi vacío no convence */
const MINIMO = 3;
/** Los que se ven sin deslizar: lo que ya encabeza una vitrina pasa al final en las siguientes */
const AL_FRENTE = 3;

/** «2026-10-30» → «30/10/2026» */
export function fechaCorta(iso: string) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** «Fidalga», «Fidalga y Amarket», «Fidalga, Amarket y Hipermaxi» */
function lista(palabras: string[]) {
  return palabras.length <= 1 ? (palabras[0] ?? '') : `${palabras.slice(0, -1).join(', ')} y ${palabras[palabras.length - 1]}`;
}

/** Lo más repetido primero */
function porFrecuencia(valores: string[]) {
  const veces = new Map<string, number>();
  valores.forEach((v) => veces.set(v, (veces.get(v) ?? 0) + 1));
  return [...veces.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
}

const unitario = (e: Escala) => e.precioUnitario!.centavos;

/**
 * Cuánto conviene una presentación frente al súper: el porcentaje que se ahorra y lo que gana la tienda por
 * unidad si lo revende al precio del súper. Null si el producto no tiene precio de súper.
 */
export function frenteAlSuper(p: Producto, escala: Escala) {
  const ref = p.precioEnSuper;
  if (!ref || !escala.precioUnitario) return null;
  const ganancia = ref.precio.centavos - unitario(escala);
  return {
    precioSuper: ref.precio.texto,
    donde: ref.donde,
    fecha: fechaCorta(ref.fecha),
    porcentaje: Math.round((ganancia / ref.precio.centavos) * 100),
    gananciaPorUnidad: ganancia,
  };
}

export function vitrinas(productos: Producto[], maximo = 10): Vitrina[] {
  const casa = preciosDeLaCasa(productos).map((p) => {
    const escalas = escalasConPrecio(p);
    return { p, chica: escalas[0], grande: escalas[escalas.length - 1] };
  });
  const llevando = (e: Escala) => `c/u llevando ${e.cantidad}`;
  const todas: Vitrina[] = [];

  const conSuper = casa
    .map((x) => ({ ...x, cuanto: frenteAlSuper(x.p, x.grande) }))
    .filter((x) => x.cuanto && x.cuanto.gananciaPorUnidad > 0);
  if (conSuper.length) {
    const fecha = fechaCorta(conSuper.map((x) => x.p.precioEnSuper!.fecha).sort().at(-1)!);
    todas.push({
      clave: 'super',
      titulo: 'Más barato que en el súper',
      subtitulo: `Comparado con ${lista(porFrecuencia(conSuper.map((x) => x.cuanto!.donde)))} · precios del ${fecha}`,
      tarjetas: [...conSuper]
        // Por el ahorro exacto: con el porcentaje redondeado empatarían productos que no ahorran lo mismo
        .sort((a, b) => b.cuanto!.gananciaPorUnidad / b.p.precioEnSuper!.precio.centavos - a.cuanto!.gananciaPorUnidad / a.p.precioEnSuper!.precio.centavos)
        .map(({ p, grande, cuanto }) => ({
          producto: p,
          precio: grande.precioUnitario!.texto,
          detalle: llevando(grande),
          gancho: `-${cuanto!.porcentaje} %`,
          tachado: `${cuanto!.precioSuper} en el súper`,
        })),
    });

    const total = (x: (typeof conSuper)[number]) => x.cuanto!.gananciaPorUnidad * x.grande.cantidad;
    todas.push({
      clave: 'reventa',
      titulo: 'Gana revendiendo',
      subtitulo: 'Si lo vendes al precio del súper, esto te queda',
      tarjetas: [...conSuper]
        // Primero lo que más deja por cada caja o fardo
        .sort((a, b) => total(b) - total(a))
        .map((x) => ({
          producto: x.p,
          precio: `+${bs(x.cuanto!.gananciaPorUnidad)}`,
          detalle: `c/u · ${bs(total(x))} por ${x.grande.cantidad}`,
          // Lo que gana sobre lo que paga
          gancho: `Ganas ${Math.round((x.cuanto!.gananciaPorUnidad / unitario(x.grande)) * 100)} %`,
          tachado: null,
        })),
    });
  }

  const deAPoco = casa.filter((x) => x.chica.cantidad <= 12);
  if (deAPoco.length) {
    const horas = Math.max(...deAPoco.map((x) => x.p.entregaHoras ?? 24));
    todas.push({
      clave: 'probar',
      titulo: 'Pruébalo con poco',
      subtitulo: `Pide poquito la primera vez · llega en ${horas} h`,
      tarjetas: deAPoco
        .map((x) => ({ ...x, total: unitario(x.chica) * x.chica.cantidad }))
        .sort((a, b) => a.total - b.total)
        .map(({ p, chica, total }) => ({
          producto: p,
          precio: bs(total),
          detalle: chica.cantidad === 1 ? 'por 1 unidad' : `por ${chica.presentacion === 'DOCENA' ? 'una docena' : `${chica.cantidad} u.`}`,
          gancho: chica.cantidad === 1 ? 'Sin mínimo' : `Mínimo ${chica.cantidad} u.`,
          tachado: null,
        })),
    });
  }

  const conAhorro = casa
    .map((x) => ({ ...x, ahorro: (unitario(x.chica) - unitario(x.grande)) * x.grande.cantidad }))
    .filter((x) => x.grande !== x.chica && x.ahorro > 0);
  todas.push({
    clave: 'volumen',
    titulo: 'Más llevas, más ahorras',
    subtitulo: 'Llevando la caja o el fardo, frente a comprar de a poco',
    tarjetas: conAhorro
      .sort((a, b) => b.ahorro - a.ahorro)
      .map(({ p, chica, grande, ahorro }) => ({
        producto: p,
        precio: grande.precioUnitario!.texto,
        detalle: llevando(grande),
        gancho: `Ahorras ${bs(ahorro)}`,
        tachado: `${chica.precioUnitario!.texto} c/u`,
      })),
  });

  const bolivianas = casa.filter((x) => x.p.marcaBoliviana && x.p.marca);
  todas.push({
    clave: 'deAqui',
    titulo: 'Marcas de aquí',
    subtitulo: `Bolivianas: ${lista([...porFrecuencia(bolivianas.map((x) => x.p.marca!)).slice(0, 3), 'más'])}`,
    tarjetas: bolivianas
      .sort((a, b) => unitario(a.grande) - unitario(b.grande))
      .map(({ p, grande }) => ({ producto: p, precio: grande.precioUnitario!.texto, detalle: llevando(grande), gancho: p.marca!, tachado: null })),
  });

  const alFrente = new Set<string>();
  return todas
    .filter((v) => v.tarjetas.length >= MINIMO)
    .map((v) => {
      const nuevos = v.tarjetas.filter((t) => !alFrente.has(t.producto.id));
      const tarjetas = [...nuevos, ...v.tarjetas.filter((t) => alFrente.has(t.producto.id))].slice(0, maximo);
      tarjetas.slice(0, AL_FRENTE).forEach((t) => alFrente.add(t.producto.id));
      return { ...v, tarjetas };
    });
}
