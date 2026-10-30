/**
 * Las direcciones de entrega del cliente, como en PedidosYa: la primera vez se toma la ubicación actual,
 * y desde ahí arriba hay un selector con las que va guardando. Viven en el teléfono.
 * Aquí solo la lógica pura; el proveedor de React y el GPS están en direcciones-estado.tsx.
 */

export type Etiqueta = 'Casa' | 'Trabajo' | 'Tienda' | 'Otra';
export const ETIQUETAS: Etiqueta[] = ['Casa', 'Tienda', 'Trabajo', 'Otra'];

export interface Direccion {
  id: string;
  etiqueta: Etiqueta;
  /** «Av. Banzer 123» */
  calle: string;
  /** «Equipetrol, Santa Cruz de la Sierra» */
  zona: string;
  /** «Casa verde de dos pisos, portón negro» */
  referencia: string;
  latitud: number | null;
  longitud: number | null;
}

/** Lo que devuelve el GPS al traducir coordenadas en una dirección (expo-location). */
export interface Geocodigo {
  street?: string | null;
  streetNumber?: string | null;
  name?: string | null;
  district?: string | null;
  subregion?: string | null;
  city?: string | null;
  region?: string | null;
}

const limpio = (partes: (string | null | undefined)[]) =>
  partes
    .map((p) => (p ?? '').trim())
    .filter((p, i, todas) => p && todas.indexOf(p) === i)
    .join(', ');

/** Arma «calle y número» y «zona, ciudad» con lo que haya; nunca deja un texto vacío. */
export function textoDeGeocodigo(g: Geocodigo): { calle: string; zona: string } {
  const calle = limpio([[g.street, g.streetNumber].filter(Boolean).join(' ')]) || (g.name ?? '').trim() || 'Mi ubicación';
  const zona = limpio([g.district, g.city ?? g.subregion, g.city ? null : g.region]);
  return { calle, zona };
}

/** Metros entre dos puntos (fórmula del haversine). */
export function distanciaMetros(a: { latitud: number; longitud: number }, b: { latitud: number; longitud: number }): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.latitud - a.latitud);
  const dLon = rad(b.longitud - a.longitud);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitud)) * Math.cos(rad(b.latitud)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/**
 * La que conviene marcar al abrir la app: la guardada que está a menos de 300 m de donde está la persona;
 * si ninguna está cerca (o no hay GPS), la última que eligió.
 */
export function sugerida(lista: Direccion[], ultimaId: string | null, aqui: { latitud: number; longitud: number } | null): Direccion | null {
  if (!lista.length) return null;
  if (aqui) {
    const cercanas = lista
      .filter((d) => d.latitud !== null && d.longitud !== null)
      .map((d) => ({ d, m: distanciaMetros(aqui, { latitud: d.latitud!, longitud: d.longitud! }) }))
      .filter((x) => x.m <= 300)
      .sort((x, y) => x.m - y.m);
    if (cercanas.length) return cercanas[0].d;
  }
  return lista.find((d) => d.id === ultimaId) ?? lista[0];
}

/** La primera es «Casa»; después, la etiqueta que todavía no se usó. */
export function etiquetaSugerida(lista: Direccion[]): Etiqueta {
  return ETIQUETAS.find((e) => e !== 'Otra' && !lista.some((d) => d.etiqueta === e)) ?? 'Otra';
}

export function iconoDeEtiqueta(e: Etiqueta): 'home' | 'storefront' | 'briefcase' | 'location' {
  return e === 'Casa' ? 'home' : e === 'Tienda' ? 'storefront' : e === 'Trabajo' ? 'briefcase' : 'location';
}

/** Lo que se ve en el encabezado: «Av. Banzer 123». */
export const resumen = (d: Direccion | null) => (d ? d.calle : 'Elige dónde te lo llevamos');
