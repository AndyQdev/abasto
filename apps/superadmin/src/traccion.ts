/**
 * Tracción: los números con los que Abasto le muestra a un mayorista que vender en la app funciona.
 * Los calcula Pedidos (solo rol admin); el nombre de cada tienda lo pone Catálogo por federación.
 */
export interface Traccion {
  pedidos: number;
  ventas: { centavos: number; texto: string };
  ticketPromedio: { texto: string };
  tiendasActivas: number;
  tiendasQueRepiten: number;
  semanas: { desde: string; pedidos: number; ventas: { centavos: number; texto: string } }[];
  tiendas: { tienda: { id: string; nombre?: string | null }; pedidos: number; ventas: { texto: string } }[];
}

export const TRACCION = `
  query Traccion($mayoristaId: ID, $semanas: Int) {
    traccion(mayoristaId: $mayoristaId, semanas: $semanas) {
      pedidos ventas { centavos texto } ticketPromedio { texto } tiendasActivas tiendasQueRepiten
      semanas { desde pedidos ventas { centavos texto } }
      tiendas { tienda { id nombre } pedidos ventas { texto } }
    }
  }`;

/** «26/10» para el lunes de cada semana */
export const semana = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Alto de cada barra en % de la semana con más venta; una semana sin venta queda en 0 */
export function alturas(semanas: Traccion['semanas']): number[] {
  const max = Math.max(0, ...semanas.map((s) => s.ventas.centavos));
  return semanas.map((s) => (max === 0 ? 0 : Math.round((s.ventas.centavos / max) * 100)));
}

/** «Repite el 50 %» de las tiendas que compraron */
export function recompra(t: Pick<Traccion, 'tiendas' | 'tiendasQueRepiten'>): string {
  if (!t.tiendas.length) return '—';
  return `${Math.round((t.tiendasQueRepiten / t.tiendas.length) * 100)} %`;
}

/** Cuánto creció la venta de la última semana completa contra la anterior */
export function crecimiento(semanas: Traccion['semanas']): string | null {
  if (semanas.length < 3) return null;
  // La última semana está en curso: se comparan las dos anteriores, que están completas
  const [anterior, ultima] = semanas.slice(-3, -1).map((s) => s.ventas.centavos);
  if (anterior === 0) return ultima > 0 ? 'nueva venta' : null;
  const cambio = Math.round(((ultima - anterior) / anterior) * 100);
  return `${cambio >= 0 ? '+' : ''}${cambio} %`;
}
