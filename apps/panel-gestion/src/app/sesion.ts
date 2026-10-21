/** Lo que el Shell le pasa al microfrontend como propiedad `sesion` (contracts/microfrontends.md). */
export interface SesionDelShell {
  token: () => Promise<string>;
  usuario: { id: string; nombre: string; orgId: string; orgNombre: string; roles: string[] };
  urls: { router: string; asistente: string; conecta: string };
}

/** Pide al Shell que navegue; el evento atraviesa el Shadow DOM (composed). */
export function pedirNavegar(origen: HTMLElement, ruta: string) {
  origen.dispatchEvent(new CustomEvent('abasto:navegar', { detail: { ruta }, bubbles: true, composed: true }));
}

export function avisar(origen: HTMLElement, texto: string) {
  origen.dispatchEvent(new CustomEvent('abasto:aviso', { detail: { texto }, bubbles: true, composed: true }));
}
