/**
 * Superadmin › Reportes: pedidos por semana, cuánto se vende en cada ciudad y cuántas tiendas compran.
 * Pedidos calcula las semanas y lo de cada tienda; la ciudad la pone Catálogo por federación.
 */
export interface SemanaDeReporte {
  desde: string;
  pedidos: number;
  tiendas: number;
  ventas: { centavos: number; texto: string };
}

export interface TiendaDeReporte {
  tienda: { id: string; nombre?: string | null; ciudad?: string | null };
  pedidos: number;
  ventas: { centavos: number; texto: string };
}

export interface Reporte {
  pedidos: number;
  ventas: { centavos: number; texto: string };
  semanas: SemanaDeReporte[];
  tiendas: TiendaDeReporte[];
}

export const REPORTE = `
  query Reporte($mayoristaId: ID, $semanas: Int) {
    traccion(mayoristaId: $mayoristaId, semanas: $semanas) {
      pedidos ventas { centavos texto }
      semanas { desde pedidos tiendas ventas { centavos texto } }
      tiendas { tienda { id nombre ciudad } pedidos ventas { centavos texto } }
    }
  }`;

export interface VentaDeCiudad {
  ciudad: string;
  tiendas: number;
  pedidos: number;
  centavos: number;
}

/** Junta las ventas por ciudad, de la que más vende a la que menos. Las tiendas de la app sin ciudad van aparte, al final. */
export function porCiudad(tiendas: TiendaDeReporte[]): VentaDeCiudad[] {
  const SIN_CIUDAD = 'Sin ciudad';
  const grupos = new Map<string, VentaDeCiudad>();
  for (const t of tiendas) {
    const ciudad = t.tienda.ciudad?.trim() || SIN_CIUDAD;
    const g = grupos.get(ciudad) ?? { ciudad, tiendas: 0, pedidos: 0, centavos: 0 };
    g.tiendas++;
    g.pedidos += t.pedidos;
    g.centavos += t.ventas.centavos;
    grupos.set(ciudad, g);
  }
  return [...grupos.values()].sort((a, b) => Number(a.ciudad === SIN_CIUDAD) - Number(b.ciudad === SIN_CIUDAD) || b.centavos - a.centavos);
}

/** Alto de cada barra en % del valor más grande; una barra con algo nunca queda invisible. */
export function escala(valores: number[]): number[] {
  const maximo = Math.max(0, ...valores);
  return valores.map((v) => (maximo === 0 || v === 0 ? 0 : Math.max(3, Math.round((v / maximo) * 100))));
}

export const textoDeBs = (centavos: number) => `Bs ${(centavos / 100).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const celda = (valor: string | number) => {
  const texto = String(valor);
  // Una fórmula en una planilla se ejecutaría al abrirla: los textos que empiezan así se escapan
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return /[";\n]/.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
};

/** Un CSV con «;», que es lo que abre bien Excel en Bolivia, con las tres vistas una debajo de otra. */
export function reporteEnCsv(r: Reporte): string {
  const filas: (string | number)[][] = [
    ['Semana (lunes)', 'Pedidos', 'Tiendas que compraron', 'Ventas (Bs)'],
    ...r.semanas.map((s) => [s.desde, s.pedidos, s.tiendas, (s.ventas.centavos / 100).toFixed(2).replace('.', ',')]),
    [],
    ['Ciudad', 'Tiendas', 'Pedidos', 'Ventas (Bs)'],
    ...porCiudad(r.tiendas).map((c) => [c.ciudad, c.tiendas, c.pedidos, (c.centavos / 100).toFixed(2).replace('.', ',')]),
  ];
  return filas.map((f) => f.map(celda).join(';')).join('\r\n');
}
