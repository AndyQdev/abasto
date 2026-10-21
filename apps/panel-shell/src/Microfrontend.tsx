import { createElement, useEffect, useRef, useState } from 'react';
import type { Sesion, Usuario } from '@abasto/sesion';
import { remotos, type NombreDeRemoto } from './remotos';

/** Lo que el Shell le pasa a cada remoto como propiedad `sesion` (ver contracts/microfrontends.md). */
export interface SesionParaRemotos {
  token: () => Promise<string>;
  usuario: Usuario;
  urls: { router: string; asistente: string; conecta: string };
}

export const URLS = {
  router: import.meta.env.VITE_ROUTER_URL ?? 'http://localhost:4000/',
  asistente: import.meta.env.VITE_ASISTENTE_URL ?? 'http://localhost:8085',
  conecta: import.meta.env.VITE_CONECTA_URL ?? 'http://localhost:8084',
};

interface Props {
  remoto: NombreDeRemoto;
  ruta: string;
  sesion: Sesion;
  usuario: Usuario;
}

export function Microfrontend({ remoto, ruta, sesion, usuario }: Props) {
  const [elemento, setElemento] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nodo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let vigente = true;
    setElemento(null);
    setError(null);
    remotos
      .cargar(remoto)
      .then((nombre) => vigente && setElemento(nombre))
      .catch((e: Error) => vigente && setError(e.message));
    return () => {
      vigente = false;
    };
  }, [remoto]);

  // La sesión va como propiedad (no atributo): lleva una función para pedir el token fresco
  useEffect(() => {
    if (!nodo.current) return;
    const datos: SesionParaRemotos = { token: () => sesion.token(), usuario, urls: URLS };
    (nodo.current as HTMLElement & { sesion?: SesionParaRemotos }).sesion = datos;
  }, [elemento, sesion, usuario]);

  if (error) {
    return (
      <div className="carta aviso-remoto">
        <strong>No se pudo cargar el módulo.</strong>
        <p>
          ¿Está corriendo? Gestión se levanta con <code>pnpm --filter @abasto/panel-gestion dev</code> e Inteligencia con{' '}
          <code>pnpm --filter @abasto/panel-inteligencia dev</code> (o todo junto con <code>pnpm dev:panel</code>).
        </p>
        <p className="mono">{error}</p>
      </div>
    );
  }
  if (!elemento) return <div className="vacio">Cargando…</div>;
  return createElement(elemento, { ref: nodo, ruta, key: elemento });
}
