/** Lo comparten el Shell y su service worker. */
export const ROUTER_URL: string = import.meta.env.VITE_ROUTER_URL ?? 'http://localhost:4000/';

/** Base de IndexedDB de la bandeja del Panel (la app de clientes usa la suya). */
export const BANDEJA_DEL_PANEL = 'abasto-panel-bandeja';
