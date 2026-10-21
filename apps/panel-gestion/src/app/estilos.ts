/**
 * Estilos que comparten las vistas. Cada vista vive en su propio Shadow DOM, así que los incluye en su `styles`.
 * Los colores y radios son variables del sistema UIX: llegan desde el Shell porque las variables CSS atraviesan el Shadow DOM.
 */
export const ESTILOS_BASE = `
  :host { display: block; font-family: var(--fuente-sans); color: hsl(var(--texto)); font-size: 0.8125rem; }
  .cabecera { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin: 0.5rem 0 1.25rem; }
  .titulo-pantalla { font-family: var(--fuente-titulo); font-size: 2.125rem; font-weight: 700; letter-spacing: -0.04em; text-transform: uppercase; line-height: 1; margin: 0; }
  .contadores { display: flex; gap: 1.5rem; color: hsl(var(--texto-2)); }
  .contadores strong { display: block; font-family: var(--fuente-titulo); font-size: 1.5rem; color: hsl(var(--texto)); }
  .filtros { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1rem; }
  .filtros .relleno { flex: 1; }
  .carta { background: hsl(var(--superficie)); border: 1px solid hsl(var(--borde)); border-radius: var(--radio-xl); box-shadow: var(--sombra-carta); padding: 1.25rem; }
  .entrada { height: var(--alto-control); padding: 0 0.875rem; border-radius: var(--radio); border: 1px solid hsl(var(--borde)); background: hsl(var(--superficie)); font: inherit; }
  .boton-primario, .boton-secundario { height: var(--alto-control); padding: 0 1rem; font: inherit; font-weight: 600; cursor: pointer; }
  .boton-primario { border: 0; border-radius: var(--radio-md); background: hsl(var(--primary)); color: hsl(var(--primary-texto)); box-shadow: var(--sombra-marca); }
  .boton-secundario { border-radius: var(--radio); background: hsl(var(--superficie)); border: 1px solid hsl(var(--borde)); color: hsl(var(--texto-2)); }
  button:disabled { opacity: 0.55; cursor: progress; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 0.625rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: hsl(var(--texto-3)); background: hsl(var(--cabecera-tabla)); padding: 0.6rem 0.9rem; }
  td { padding: 0.7rem 0.9rem; border-top: 1px solid hsl(var(--borde)); vertical-align: middle; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .mono { font-family: var(--fuente-mono); }
  .gris { color: hsl(var(--texto-3)); font-size: 0.6875rem; display: block; }
  .insignia { display: inline-block; border-radius: 9999px; padding: 0.25rem 0.625rem; font-size: 0.6875rem; font-weight: 600; }
  .exito { background: hsl(var(--exito-suave)); color: hsl(var(--exito-suave-texto)); }
  .advertencia { background: hsl(var(--advertencia-suave)); color: hsl(var(--advertencia-suave-texto)); }
  .error { background: hsl(var(--error-suave)); color: hsl(var(--error-suave-texto)); }
  .neutro { background: hsl(var(--neutro-suave)); color: hsl(var(--neutro-suave-texto)); }
  .vacio { padding: 2rem; text-align: center; color: hsl(var(--texto-3)); }
  .falla { padding: 1rem; border-radius: var(--radio); background: hsl(var(--error-suave)); color: hsl(var(--error-suave-texto)); }
  .acciones { display: flex; gap: 0.5rem; justify-content: flex-end; }
`;

export const ESTADOS_DE_PEDIDO: Record<string, { texto: string; clase: string }> = {
  PENDIENTE: { texto: 'Pendiente', clase: 'neutro' },
  POR_CONFIRMAR: { texto: 'Por confirmar', clase: 'advertencia' },
  CONFIRMADO: { texto: 'Confirmado', clase: 'exito' },
  EN_PREPARACION: { texto: 'En preparación', clase: 'exito' },
  DESPACHADO: { texto: 'Despachado', clase: 'exito' },
  ENTREGADO: { texto: 'Entregado', clase: 'exito' },
  RECHAZADO: { texto: 'Rechazado', clase: 'error' },
  CANCELADO: { texto: 'Cancelado', clase: 'neutro' },
};

export const PRESENTACION: Record<string, [string, string]> = {
  UNIDAD: ['unidad', 'unidades'],
  CUARTA: ['cuarta', 'cuartas'],
  DOCENA: ['docena', 'docenas'],
  CAJA: ['caja', 'cajas'],
  FARDO: ['fardo', 'fardos'],
};

/** «2 cajas · 96 u.»: la cantidad siempre va con su unidad. */
export function cantidadConUnidad(cantidad: number, presentacion: string, unidades: number): string {
  const [singular, plural] = PRESENTACION[presentacion] ?? [presentacion.toLowerCase(), presentacion.toLowerCase()];
  return `${cantidad} ${cantidad === 1 ? singular : plural} · ${unidades} u.`;
}
