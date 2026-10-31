import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { sugerida, textoDeGeocodigo, type Direccion } from './direcciones';
import { guardado } from './guardado';

/** Un problema con el GPS que se le puede mostrar al cliente. */
export class ErrorDeUbicacion extends Error {}

export interface PuntoActual {
  latitud: number;
  longitud: number;
  calle: string;
  zona: string;
}

/** Dónde está el teléfono ahora, con el nombre de la calle. Pide permiso la primera vez. */
export async function ubicacionActual(): Promise<PuntoActual> {
  const permiso = await Location.requestForegroundPermissionsAsync();
  if (permiso.status !== 'granted') {
    throw new ErrorDeUbicacion('Sin permiso de ubicación. Puedes escribir tu dirección a mano.');
  }
  // Precisión alta (GPS): es una dirección de entrega. Puede tardar o no responder nunca (sin cielo): a los 10 s, la última conocida
  const posicion =
    (await conLimite(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), 10_000)) ??
    (await Location.getLastKnownPositionAsync().catch(() => null));
  if (!posicion) {
    throw new ErrorDeUbicacion('No pudimos encontrar tu ubicación. Revisa que el GPS esté prendido o escríbela a mano.');
  }
  const { latitude: latitud, longitude: longitud } = posicion.coords;
  return { latitud, longitud, ...(await calleDe({ latitud, longitud })) };
}

/**
 * El nombre de la calle de un punto del mapa. Viene de internet: si tarda o falla, «Mi ubicación»
 * y la calle se escribe a mano.
 */
export async function calleDe(p: { latitud: number; longitud: number }): Promise<{ calle: string; zona: string }> {
  const lugares = (await conLimite(Location.reverseGeocodeAsync({ latitude: p.latitud, longitude: p.longitud }), 6_000)) ?? [];
  return textoDeGeocodigo(lugares[0] ?? {});
}

/** Dónde está el teléfono sin pedir permiso ni esperar el GPS (para abrir el mapa ahí). Null si no se sabe. */
export async function ultimaUbicacion(): Promise<{ latitud: number; longitud: number } | null> {
  const permiso = await Location.getForegroundPermissionsAsync().catch(() => null);
  if (permiso?.status !== 'granted') return null;
  const p = await Location.getLastKnownPositionAsync().catch(() => null);
  return p ? { latitud: p.coords.latitude, longitud: p.coords.longitude } : null;
}

/** La promesa, o null si falla o tarda más de `ms`. */
function conLimite<T>(promesa: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promesa.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

interface Direcciones {
  cargando: boolean;
  lista: Direccion[];
  elegida: Direccion | null;
  /** Al abrir la app se pregunta una vez «Confirma tu dirección» */
  porConfirmar: boolean;
  confirmar: (id: string) => void;
  guardar: (d: Omit<Direccion, 'id'>) => Promise<Direccion>;
  borrar: (id: string) => Promise<void>;
}

const Contexto = createContext<Direcciones | null>(null);

export function ProveedorDeDirecciones({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [lista, setLista] = useState<Direccion[]>([]);
  const [elegidaId, setElegidaId] = useState<string | null>(null);
  const [porConfirmar, setPorConfirmar] = useState(true);

  useEffect(() => {
    void (async () => {
      const [guardadas, ultima] = await Promise.all([guardado.leer<Direccion[]>('direcciones'), guardado.leer<string>('direccion-elegida')]);
      const todas = guardadas ?? [];
      setLista(todas);
      setElegidaId(sugerida(todas, ultima, null)?.id ?? null);
      setCargando(false);
      // Si el GPS responde rápido y ya tiene permiso, se marca la que está más cerca (sin pedir nada)
      if (todas.length > 1) {
        const permiso = await Location.getForegroundPermissionsAsync().catch(() => null);
        if (permiso?.status === 'granted') {
          const ultimaConocida = await Location.getLastKnownPositionAsync().catch(() => null);
          if (ultimaConocida) {
            const aqui = { latitud: ultimaConocida.coords.latitude, longitud: ultimaConocida.coords.longitude };
            setElegidaId(sugerida(todas, ultima, aqui)?.id ?? null);
          }
        }
      }
    })();
  }, []);

  const confirmar = useCallback((id: string) => {
    setElegidaId(id);
    setPorConfirmar(false);
    void guardado.escribir('direccion-elegida', id);
  }, []);

  const guardar = useCallback(
    async (d: Omit<Direccion, 'id'>) => {
      const nueva: Direccion = { ...d, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` };
      const todas = [nueva, ...lista];
      setLista(todas);
      await guardado.escribir('direcciones', todas);
      confirmar(nueva.id);
      return nueva;
    },
    [lista, confirmar],
  );

  const borrar = useCallback(
    async (id: string) => {
      const todas = lista.filter((d) => d.id !== id);
      setLista(todas);
      await guardado.escribir('direcciones', todas);
      if (id === elegidaId) setElegidaId(todas[0]?.id ?? null);
    },
    [lista, elegidaId],
  );

  const valor = useMemo<Direcciones>(
    () => ({
      cargando,
      lista,
      elegida: lista.find((d) => d.id === elegidaId) ?? null,
      porConfirmar: porConfirmar && lista.length > 0,
      confirmar,
      guardar,
      borrar,
    }),
    [cargando, lista, elegidaId, porConfirmar, confirmar, guardar, borrar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useDirecciones(): Direcciones {
  const d = useContext(Contexto);
  if (!d) throw new Error('useDirecciones fuera de ProveedorDeDirecciones');
  return d;
}
