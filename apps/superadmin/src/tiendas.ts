/**
 * Superadmin › Tiendas: quién compra en Abasto, cuánto y si su cuenta está activa.
 * Los datos de la tienda son de Catálogo y lo que compró sale de Pedidos (la misma consulta de Tracción).
 */
export interface TiendaDeAbasto {
  id: string;
  nombre: string;
  ciudad: string;
  telefono: string | null;
  registradaEn: string | null;
  dePrueba: boolean;
  suspendida: boolean;
  motivoSuspension: string | null;
  negocio: { tipo: string; subtipo: string | null } | null;
}

const CAMPOS = 'id nombre ciudad telefono registradaEn dePrueba suspendida motivoSuspension negocio { tipo subtipo }';

export const TIENDAS = `query Tiendas { tiendas { ${CAMPOS} } }`;
export const SUSPENDER = `mutation Suspender($id: ID!, $motivo: String!) { suspenderTienda(id: $id, motivo: $motivo) { ${CAMPOS} } }`;
export const REACTIVAR = `mutation Reactivar($id: ID!) { reactivarTienda(id: $id) { ${CAMPOS} } }`;
export const COMPRAS = `query Compras { traccion(semanas: 26) { tiendas { tienda { id } pedidos ventas { texto } } } }`;

export type FiltroDeTiendas = 'todas' | 'activas' | 'suspendidas';

export const FILTROS: { valor: FiltroDeTiendas; texto: string }[] = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'activas', texto: 'Activas' },
  { valor: 'suspendidas', texto: 'Suspendidas' },
];

const SUBTIPOS: Record<string, string> = {
  salteneria: 'Salteñería',
  panaderia: 'Panadería',
  horneados: 'Horneados',
  pension: 'Pensión',
  polleria: 'Pollería',
  puesto: 'Puesto de comida',
};

/** «Tienda», «Hogar» o «Productor · Salteñería». */
export function textoDeNegocio(negocio: TiendaDeAbasto['negocio']): string {
  if (!negocio) return 'Sin elegir';
  if (negocio.tipo === 'hogar') return 'Hogar';
  if (negocio.tipo === 'tienda') return 'Tienda';
  const subtipo = negocio.subtipo ? SUBTIPOS[negocio.subtipo] : null;
  return subtipo ? `Productor · ${subtipo}` : 'Productor';
}

const sinTildes = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Busca por nombre, ciudad o celular, sin importar tildes ni mayúsculas. */
export function filtrarTiendas(tiendas: TiendaDeAbasto[], filtro: FiltroDeTiendas, busqueda: string): TiendaDeAbasto[] {
  const q = sinTildes(busqueda.trim());
  return tiendas.filter((t) => {
    if (filtro === 'activas' && t.suspendida) return false;
    if (filtro === 'suspendidas' && !t.suspendida) return false;
    return !q || sinTildes(`${t.nombre} ${t.ciudad} ${t.telefono ?? ''}`).includes(q);
  });
}

/** «+591 712 34 567» para leerlo de un vistazo. */
export function celular(telefono: string | null): string {
  if (!telefono) return '—';
  const m = /^591(\d{3})(\d{2})(\d{3})$/.exec(telefono);
  return m ? `+591 ${m[1]} ${m[2]} ${m[3]}` : telefono;
}
