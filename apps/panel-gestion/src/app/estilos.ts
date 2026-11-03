/**
 * Estilos que comparten las vistas (versión 7 «Halo»). Cada vista vive en su propio Shadow DOM, así que los incluye en su `styles`.
 * Los colores y radios son variables del sistema UIX: llegan desde el Shell (halo.css) porque las variables CSS atraviesan el Shadow DOM.
 */
export const ESTILOS_BASE = `
  :host { display: block; font-family: var(--fuente-sans); color: hsl(var(--texto)); font-size: 0.9375rem; }
  * { box-sizing: border-box; }
  button { font: inherit; color: inherit; cursor: pointer; }

  /* Cabecera de cada sección: título grande bosque, subtítulo corto y un contador en cápsula blanca */
  .cabecera { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem 1.5rem; flex-wrap: wrap; margin: 0 0 1.4rem; padding-left: 1rem; }
  .titulo-pantalla { font-family: var(--fuente-titulo); font-size: clamp(2.4rem, 3.6vw, 3.4rem); font-weight: 800; letter-spacing: -0.045em; line-height: 1; margin: 0; color: hsl(var(--tinta)); }
  .subtitulo { margin: 0.5rem 0 0; font-size: 1.4rem; color: hsl(var(--texto-2)); font-weight: 500; }
  .capsula-contador { display: inline-flex; align-items: center; gap: 0.6rem; padding: 0.75rem 1.4rem; font-size: 1.3rem; border-radius: 999px; background: hsl(var(--superficie)); box-shadow: var(--sombra-menor); font-weight: 800; letter-spacing: -0.02em; white-space: nowrap; }

  /* Tres cifras grandes en tarjetas */
  .cifras { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.25rem; margin-bottom: 1.25rem; }
  .cifra-carta { display: flex; align-items: center; gap: 1.4rem; padding: 1.4rem 1.75rem; border-radius: 30px; background: hsl(var(--superficie)); box-shadow: var(--sombra-carta); border: 0; text-align: left; min-width: 0; color: inherit; }
  button.cifra-carta { cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; }
  button.cifra-carta:hover { transform: translateY(-2px); }
  button.cifra-carta.elegida { box-shadow: 0 0 0 3px hsl(var(--primary)), var(--sombra-carta); }
  .cifra-carta .linea-v { width: 2px; align-self: stretch; margin: 0.4rem 0; background: hsl(var(--borde)); border-radius: 2px; }
  .cifra-carta strong { display: block; font-size: clamp(1.8rem, 2.6vw, 2.6rem); font-weight: 800; letter-spacing: -0.04em; line-height: 1; white-space: nowrap; }
  .cifra-carta div > span { display: block; margin-top: 0.35rem; font-size: 1.4rem; color: hsl(var(--texto)); font-weight: 500; }
  .disco { flex: none; display: grid; place-items: center; width: 64px; height: 64px; border-radius: 20px; color: hsl(var(--tinta)); }
  .disco.ambar { background: hsl(var(--ambar)); }
  .disco.lima { background: hsl(var(--primary)); }
  .disco.menta { background: hsl(var(--menta)); }
  .disco.rojo { background: hsl(var(--error-suave)); color: hsl(var(--error-suave-texto)); }
  .disco.chico { width: 40px; height: 40px; border-radius: 14px; }

  /* Barra de filtros: un grupo de opciones en cápsula blanca; la elegida, lima */
  .barra { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
  .segmentos { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 0; padding: 5px; border-radius: 30px; background: hsl(var(--superficie)); box-shadow: var(--sombra-menor); max-width: 100%; }
  .segmentos > .etiqueta-grupo { padding: 0 0.6rem 0 0.9rem; font-weight: 800; white-space: nowrap; }
  .segmento { position: relative; display: inline-flex; align-items: center; gap: 0.45rem; height: 42px; padding: 0 1.3rem; border: 0; border-radius: 999px; background: transparent; font-weight: 500; font-size: 1.15rem; white-space: nowrap; color: hsl(var(--texto)); }
  /* La rayita fina entre opciones; se esconde junto a la elegida */
  .segmento + .segmento::before { content: ''; position: absolute; left: 0; top: 50%; width: 1.5px; height: 22px; transform: translateY(-50%); background: hsl(var(--borde-fuerte)); }
  .segmento.elegido::before, .segmento.elegido + .segmento::before, .segmento:hover::before, .segmento:hover + .segmento::before { display: none; }
  .segmento:hover { background: hsl(var(--primary-suave)); }
  .segmento.elegido { background: hsl(var(--primary)); font-weight: 800; box-shadow: 0 8px 16px -10px hsl(77 70% 40% / 0.9); }
  .segmento.oscuro.elegido { background: hsl(var(--tinta)); color: #fff; box-shadow: none; }
  .segmento small { font-weight: 700; opacity: 0.6; }

  /* Botones: todos en cápsula */
  .boton-primario, .boton-secundario, .boton-oscuro, .boton-contorno, .boton-suave, .boton-peligro {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.55rem; height: 48px; padding: 0 1.5rem;
    border-radius: 999px; font-weight: 800; font-size: 1.12rem; letter-spacing: -0.01em; white-space: nowrap; border: 0; text-decoration: none;
    transition: transform 0.12s, box-shadow 0.15s, background 0.15s;
  }
  .boton-primario { background: hsl(var(--primary)); color: hsl(var(--tinta)); box-shadow: var(--sombra-marca); }
  .boton-primario:hover:not(:disabled) { transform: translateY(-1px); background: hsl(77 85% 60%); }
  .boton-oscuro { background: hsl(var(--tinta)); color: #fff; }
  .boton-oscuro:hover:not(:disabled) { background: hsl(157 30% 20%); }
  .boton-contorno { background: transparent; color: hsl(var(--tinta)); box-shadow: inset 0 0 0 2px hsl(var(--tinta)); }
  .boton-contorno:hover:not(:disabled) { background: hsl(var(--primary-suave)); }
  .boton-suave { background: hsl(var(--primary-suave)); color: hsl(var(--tinta)); }
  .boton-suave:hover:not(:disabled) { background: hsl(80 80% 84%); }
  .boton-secundario { background: hsl(var(--superficie)); color: hsl(var(--texto-2)); box-shadow: inset 0 0 0 1.5px hsl(var(--borde-fuerte)); }
  .boton-secundario:hover:not(:disabled) { color: hsl(var(--texto)); }
  .boton-peligro { background: hsl(var(--error-suave)); color: hsl(var(--error-suave-texto)); }
  .boton-chico { height: 42px; padding: 0 1.2rem; font-size: 1.05rem; }
  button:disabled { opacity: 0.55; cursor: progress; }

  .carta { background: hsl(var(--superficie)); border-radius: 30px; box-shadow: var(--sombra-carta); padding: 1.4rem; }
  .entrada { height: 46px; padding: 0 1rem; border-radius: 16px; border: 1.5px solid hsl(var(--borde)); background: hsl(var(--superficie)); font: inherit; color: inherit; min-width: 0; }
  .entrada:focus { outline: none; border-color: hsl(var(--tinta)); box-shadow: 0 0 0 4px hsl(var(--primary) / 0.45); }

  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 0.75rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: hsl(var(--texto-3)); padding: 0.75rem 1rem; }
  td { padding: 0.85rem 1rem; border-top: 1px solid hsl(var(--borde)); vertical-align: middle; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .mono { font-family: var(--fuente-mono); }
  .gris { color: hsl(var(--texto-3)); font-size: 0.8125rem; display: block; }

  .insignia { display: inline-flex; align-items: center; gap: 0.35rem; border-radius: 999px; padding: 0.3rem 0.8rem; font-size: 0.8125rem; font-weight: 700; white-space: nowrap; }
  .exito { background: hsl(var(--exito-suave)); color: hsl(var(--exito-suave-texto)); }
  .lima { background: hsl(var(--primary-suave)); color: hsl(var(--primary-suave-texto)); }
  .advertencia { background: hsl(var(--advertencia-suave)); color: hsl(var(--advertencia-suave-texto)); }
  .error { background: hsl(var(--error-suave)); color: hsl(var(--error-suave-texto)); }
  .neutro { background: hsl(var(--tenue)); color: hsl(var(--texto-2)); }

  .vacio { padding: 2.5rem 1rem; text-align: center; color: hsl(var(--texto-2)); font-size: 1rem; }
  .falla { padding: 1rem 1.25rem; border-radius: 20px; background: hsl(var(--error-suave)); color: hsl(var(--error-suave-texto)); margin: 0 0 1rem; }
  .acciones { display: flex; gap: 0.5rem; justify-content: flex-end; flex-wrap: wrap; }
  .oculto { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

  /* Miniatura de producto: la foto real o su inicial */
  .mini { flex: none; width: 46px; height: 46px; border-radius: 50%; background: hsl(var(--tenue)); box-shadow: 0 0 0 3px hsl(var(--superficie)); display: grid; place-items: center; font-weight: 800; color: hsl(var(--texto-3)); overflow: hidden; }
  .mini img { width: 100%; height: 100%; object-fit: cover; }

  /* Panel lateral (detalle y formularios) */
  .velo { position: fixed; inset: 0; z-index: 100; background: rgba(24, 45, 37, 0.35); display: flex; justify-content: flex-end; animation: aparecer 0.15s ease; }
  .lateral { width: min(560px, 100vw); height: 100%; background: hsl(var(--fondo)); box-shadow: -30px 0 60px -30px rgba(0, 0, 0, 0.5); display: flex; flex-direction: column; border-radius: 34px 0 0 34px; animation: entrar 0.2s ease; }
  .lateral-cabeza { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1.75rem 1.75rem 1rem; }
  .lateral-cabeza h2 { margin: 0; font-size: 1.9rem; font-weight: 800; letter-spacing: -0.04em; }
  .lateral-cuerpo { flex: 1; overflow-y: auto; padding: 0 1.75rem 1.5rem; display: grid; gap: 1rem; align-content: start; }
  .lateral-pie { padding: 1rem 1.75rem 1.5rem; display: flex; gap: 0.75rem; flex-wrap: wrap; border-top: 1px solid hsl(var(--borde)); background: hsl(var(--superficie)); border-radius: 0 0 0 34px; }
  .lateral-pie > * { flex: 1; }
  .cerrar { flex: none; width: 44px; height: 44px; border-radius: 50%; border: 0; background: hsl(var(--superficie)); display: grid; place-items: center; box-shadow: var(--sombra-menor); }
  @keyframes aparecer { from { opacity: 0; } }
  @keyframes entrar { from { transform: translateX(40px); opacity: 0.4; } }

  @media (max-width: 1180px) { .cifras { grid-template-columns: minmax(0, 1fr); } .cifra-carta { padding: 1rem 1.25rem; } }
  @media (max-width: 860px) {
    .lateral, .lateral-pie { border-radius: 0; }
    .subtitulo { font-size: 1rem; }
  }
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

/** La foto que sirve Catálogo, o null. Catálogo arma la URL completa. */
export const fotoDe = (p: { foto?: string | null }) => p.foto ?? null;

/** La inicial para la miniatura sin foto. */
export const inicial = (nombre?: string | null) => (nombre ?? '?').trim().charAt(0).toUpperCase();

/** Lo que el buscador del header dejó en la URL (?q=). */
export const busquedaDeLaUrl = () => new URLSearchParams(window.location.search).get('q') ?? '';

/** «hace 5 min», «hace 2 h», «ayer», «31/10» */
export function haceCuanto(fecha: string, ahora = Date.now()): string {
  const minutos = Math.max(0, Math.round((ahora - new Date(fecha).getTime()) / 60000));
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  if (horas < 48) return 'ayer';
  const d = new Date(fecha);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
