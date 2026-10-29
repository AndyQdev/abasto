import { AlmacenIndexedDB, Bandeja } from '@abasto/outbox-offline';
import { useEffect, useMemo, useState } from 'react';
import { BANDEJA_DEL_PANEL, ROUTER_URL } from './config';
import { enviarAlRouter } from './sincronizar';

export interface EstadoSinSenal {
  enLinea: boolean;
  /** Cambios hechos sin señal que todavía no llegaron al servidor */
  pendientes: number;
  /** Alguna pantalla se está mostrando con datos guardados */
  desdeCache: boolean;
}

/**
 * Estado de la conexión para la barra del Panel. Al volver la señal manda la bandeja con el token vigente
 * y avisa cuántos cambios salieron (y cuáles rechazó el servidor).
 */
export function useSinSenal(token: () => Promise<string>, avisar: (texto: string) => void): EstadoSinSenal {
  const bandeja = useMemo(() => new Bandeja(new AlmacenIndexedDB(BANDEJA_DEL_PANEL), enviarAlRouter(ROUTER_URL, token)), [token]);
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);
  const [pendientes, setPendientes] = useState(0);
  const [desdeCache, setDesdeCache] = useState(false);

  useEffect(() => {
    const contar = async () => setPendientes((await bandeja.pendientes()).length);
    const sincronizar = async () => {
      const antes = new Set((await bandeja.pendientes()).map((o) => o.clave));
      if (!antes.size || !navigator.onLine) return;
      await bandeja.sincronizar();
      const salieron = (await bandeja.pendientes()).filter((o) => antes.has(o.clave)).length;
      const enviados = antes.size - salieron;
      if (enviados > 0) avisar(`Se enviaron ${enviados} cambios que hiciste sin señal`);
      await contar();
    };
    const alVolver = () => {
      setEnLinea(true);
      setDesdeCache(false);
      void sincronizar();
    };
    const alIrse = () => setEnLinea(false);
    const alMensaje = (e: MessageEvent<{ tipo?: string }>) => {
      if (e.data?.tipo === 'abasto:en-cola') void contar();
      if (e.data?.tipo === 'abasto:desde-cache') setDesdeCache(true);
    };
    const quitar = bandeja.alCambiar((ops) => {
      setPendientes(ops.filter((o) => o.estado === 'pendiente').length);
      const rechazada = ops.find((o) => o.estado === 'rechazada' && o.error);
      if (rechazada) avisar(`Un cambio hecho sin señal no se pudo aplicar: ${rechazada.error}`);
    });

    window.addEventListener('online', alVolver);
    window.addEventListener('offline', alIrse);
    navigator.serviceWorker?.addEventListener('message', alMensaje);
    void contar().then(sincronizar);
    return () => {
      quitar();
      window.removeEventListener('online', alVolver);
      window.removeEventListener('offline', alIrse);
      navigator.serviceWorker?.removeEventListener('message', alMensaje);
    };
  }, [bandeja, avisar]);

  return { enLinea, pendientes, desdeCache };
}
