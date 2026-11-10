import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { borrarModelo, cancelarDescarga, descargarModelo, estaInstalado, type Progreso } from './descargas';
import { capacidadesDelTelefono, nombreDelTelefono } from './dispositivo';
import type { Interprete } from './motor';
import { cargarLlama } from '../perezoso';
import { manifiesto, modeloRecomendado, modelosPosibles, nivelDelDispositivo, todosLosModelos, type Capacidades, type ModeloLocal, type Nivel } from './modelos';

/** El modelo elegido sobrevive a cerrar la app */
const CLAVE = 'abasto.ia.modelo';
const SIN_MODELO = 'ninguno';
/** El interruptor «Usar la IA de tu teléfono» de Buscar con una foto */
const CLAVE_USAR = 'abasto.ia.usar';

export interface IaLocal {
  telefono: string;
  capacidades: Capacidades | null;
  nivel: Nivel;
  recomendado: ModeloLocal | null;
  posibles: ModeloLocal[];
  /** Todos los del manifiesto que el procesador corre, aunque pidan más memoria (se avisa con una etiqueta) */
  todos: ModeloLocal[];
  /** Los modelos que ya están enteros en el teléfono */
  instalados: string[];
  /** El modelo que usa el asistente (bajado y elegido) */
  activo: ModeloLocal | null;
  progreso: (Progreso & { modeloId: string }) | null;
  /** «Cargando el modelo» (los primeros segundos después de abrir la app) */
  cargando: boolean;
  error: string | null;
  descargar: (m: ModeloLocal) => Promise<void>;
  cancelar: () => Promise<void>;
  borrar: (m: ModeloLocal) => Promise<void>;
  usar: (m: ModeloLocal | null) => Promise<void>;
  /** Si la persona prendió «Usar la IA de tu teléfono» (sin modelo bajado no hace nada: se pide bajarlo) */
  usarIa: boolean;
  cambiarUsarIa: (v: boolean) => void;
  /** El intérprete del modelo activo; lo carga la primera vez. null si no hay modelo bajado (se usan las reglas). */
  interprete: () => Promise<Interprete | null>;
}

const Contexto = createContext<IaLocal | null>(null);

export function ProveedorDeIaLocal({ children }: { children: ReactNode }) {
  const [capacidades, setCapacidades] = useState<Capacidades | null>(null);
  const [instalados, setInstalados] = useState<string[]>([]);
  const [activoId, setActivoId] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<IaLocal['progreso']>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usarIa, setUsarIa] = useState(false);
  const cargado = useRef<{ id: string; interprete: Promise<Interprete> } | null>(null);

  const revisar = useCallback(async () => {
    const listos: string[] = [];
    for (const m of manifiesto.modelos) if (await estaInstalado(m)) listos.push(m.id);
    setInstalados(listos);
    return listos;
  }, []);

  useEffect(() => {
    void (async () => {
      setCapacidades(await capacidadesDelTelefono());
      const listos = await revisar();
      const guardado = await AsyncStorage.getItem(CLAVE).catch(() => null);
      setUsarIa((await AsyncStorage.getItem(CLAVE_USAR).catch(() => null)) === 'si');
      // «ninguno» es una elección: probar o usar la app solo con las reglas y el reconocedor
      setActivoId(guardado === SIN_MODELO ? null : guardado && listos.includes(guardado) ? guardado : (listos[0] ?? null));
    })();
  }, [revisar]);

  const activo = manifiesto.modelos.find((m) => m.id === activoId) ?? null;

  const usar = useCallback(async (m: ModeloLocal | null) => {
    if (cargado.current && cargado.current.id !== m?.id) {
      const anterior = cargado.current.interprete;
      cargado.current = null;
      await anterior.then((i) => i.liberar()).catch(() => undefined);
    }
    setActivoId(m?.id ?? null);
    await AsyncStorage.setItem(CLAVE, m?.id ?? SIN_MODELO).catch(() => undefined);
  }, []);

  const descargar = useCallback(
    async (m: ModeloLocal) => {
      setError(null);
      setProgreso({ modeloId: m.id, bajados: 0, total: 1, fraccion: 0 });
      try {
        await descargarModelo(m, (p) => setProgreso({ ...p, modeloId: m.id }));
        await revisar();
        await usar(m);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setProgreso(null);
      }
    },
    [revisar, usar],
  );

  const borrar = useCallback(
    async (m: ModeloLocal) => {
      if (activoId === m.id) await usar(null);
      await borrarModelo(m);
      await revisar();
    },
    [activoId, revisar, usar],
  );

  const cambiarUsarIa = useCallback((v: boolean) => {
    setUsarIa(v);
    void AsyncStorage.setItem(CLAVE_USAR, v ? 'si' : 'no').catch(() => undefined);
  }, []);

  const interprete = useCallback(async () => {
    if (!activo) return null;
    if (cargado.current?.id !== activo.id) {
      setCargando(true);
      const promesa = cargarLlama(activo);
      cargado.current = { id: activo.id, interprete: promesa };
      promesa.catch((e: Error) => {
        cargado.current = null;
        setError(`No se pudo cargar ${activo.nombre}: ${e.message}`);
      }).finally(() => setCargando(false));
    }
    return cargado.current!.interprete.catch(() => null);
  }, [activo]);

  const valor = useMemo<IaLocal>(() => {
    const c = capacidades ?? { memoriaMb: null, arquitecturas: [], espacioLibreMb: null };
    return {
      telefono: nombreDelTelefono(),
      capacidades,
      nivel: nivelDelDispositivo(c),
      recomendado: modeloRecomendado(c),
      posibles: modelosPosibles(c),
      todos: todosLosModelos(c),
      instalados,
      activo,
      progreso,
      cargando,
      error,
      descargar,
      cancelar: cancelarDescarga,
      borrar,
      usar,
      usarIa,
      cambiarUsarIa,
      interprete,
    };
  }, [capacidades, instalados, activo, progreso, cargando, error, descargar, borrar, usar, usarIa, cambiarUsarIa, interprete]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useIaLocal(): IaLocal {
  const ia = useContext(Contexto);
  if (!ia) throw new Error('useIaLocal fuera de ProveedorDeIaLocal');
  return ia;
}
