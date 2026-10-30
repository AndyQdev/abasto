/**
 * Cuánto se espera vender la próxima semana y para cuántos días alcanza el stock.
 * Lo usan el tablero de Inteligencia y el agente de Reposición, así los dos dicen lo mismo.
 */
export interface StockDeProducto {
  producto_id: string;
  nombre: string;
  stock: number;
  vendidas_por_dia: number;
}

export interface PrediccionDeDemanda {
  producto_id: string;
  /** Lunes de la semana, aaaa-mm-dd */
  semana: string;
  unidades: number;
}

export interface DemandaDeLaSemana {
  producto_id: string;
  nombre: string;
  stock: number;
  unidades_semana: number;
  /** null cuando no se espera vender nada: el stock no se agota */
  dias_de_stock: number | null;
}

export const DIAS_CRITICOS = 7;
export const SEMANAS_A_CUBRIR = 2;

const unDecimal = (n: number) => Math.round(n * 10) / 10;

/**
 * Usa la primera semana que predijo el modelo de ML para cada producto.
 * Si el ML todavía no corrió, estima con el promedio de los últimos 30 días.
 * Los más urgentes primero.
 */
export function demandaDeLaSemana(stock: StockDeProducto[], predicciones: PrediccionDeDemanda[]): DemandaDeLaSemana[] {
  const primera = new Map<string, PrediccionDeDemanda>();
  for (const p of predicciones) {
    const actual = primera.get(p.producto_id);
    if (!actual || p.semana < actual.semana) primera.set(p.producto_id, p);
  }

  return stock
    .map((s) => {
      const unidades = unDecimal(Number(primera.get(s.producto_id)?.unidades ?? Number(s.vendidas_por_dia) * 7));
      const stockActual = Number(s.stock);
      return {
        producto_id: s.producto_id,
        nombre: s.nombre,
        stock: stockActual,
        unidades_semana: unidades,
        dias_de_stock: unidades > 0 ? unDecimal((stockActual * 7) / unidades) : null,
      };
    })
    .sort(
      (a, b) =>
        (a.dias_de_stock ?? Infinity) - (b.dias_de_stock ?? Infinity) || a.nombre.localeCompare(b.nombre, 'es'),
    );
}

export function enRiesgo(d: DemandaDeLaSemana, dias = DIAS_CRITICOS): boolean {
  return d.dias_de_stock !== null && d.dias_de_stock < dias;
}

/** Lo que falta para cubrir dos semanas de demanda, en unidades enteras. */
export function cantidadAPedir(d: DemandaDeLaSemana, semanas = SEMANAS_A_CUBRIR): number {
  return Math.max(0, Math.ceil(d.unidades_semana * semanas - d.stock));
}
