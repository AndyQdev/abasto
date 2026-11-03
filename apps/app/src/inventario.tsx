import {
  ajusteAMano,
  articuloAMano,
  cuantosCambios,
  datosVacios,
  entradaAMano,
  MI_NEGOCIO,
  SINCRONIZAR_MI_NEGOCIO,
  sincronizarCompras,
  sinMarca,
  type Articulo,
  type CambiosDeNegocio,
  type ClaseDeArticulo,
  type DatosDeNegocio,
  type Existencia,
  type Medida,
  type PedidoComprado,
  type RespuestaMiNegocio,
  type RespuestaSincronizar,
} from '@abasto/comercio';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { graphql } from './api';
import type { AlmacenLocal } from './almacen-local';
import { almacenDeNegocio } from './almacen-negocio';

/**
 * «Mi negocio» en la app (docs/plan-mi-negocio.md). La base de datos es la del servidor (esquema `negocio` de Cobros);
 * el teléfono guarda una copia y una cola para andar sin señal:
 * - Cada acción (vender, fiar, ajustar, una receta…) arma sus cambios con el motor de packages/comercio y los pasa a
 *   `aplicar`: se guardan aquí al instante y quedan en la cola.
 * - Con señal, la cola sube sola (`sincronizarMiNegocio`) y se baja lo nuevo (`miNegocio(desde)`): al abrir, al
 *   volver la señal y un momento después de cada cambio. En un celular nuevo se baja todo.
 * - Lo comprado en Abasto entra solo (`sincronizar` con los pedidos; el servidor también lo registra al entregarse).
 */
export type EstadoDeLaNube = 'al-dia' | 'por-subir' | 'subiendo' | 'sin-senal' | 'error';

interface EstadoDeInventario {
  datos: DatosDeNegocio;
  cargando: boolean;
  nube: EstadoDeLaNube;
  /** Cuántos cambios esperan subir */
  porSubir: number;
  /** Guarda los cambios de una acción (y los sube cuando se pueda) */
  aplicar: (cambios: CambiosDeNegocio) => Promise<void>;
  /** Registra lo entregado que falta. Devuelve cuántas líneas entraron */
  sincronizar: (pedidos: PedidoComprado[]) => Promise<number>;
  /** Sube y baja ahora (tirar para actualizar) */
  sincronizarAhora: () => Promise<void>;
  agregarAMano: (
    entrada: { nombre: string; medida: Medida; proveedor?: string | null; clase?: ClaseDeArticulo },
    cantidad: number,
    costoUnitarioCentavos: number | null,
  ) => Promise<Articulo>;
  sumar: (articulo: Articulo, cantidad: number, costoUnitarioCentavos: number | null) => Promise<void>;
  /** Guarda lo contado; false si no cambió nada */
  ajustar: (existencia: Existencia, contada: number) => Promise<boolean>;
}

const Contexto = createContext<EstadoDeInventario | null>(null);

export const nuevoId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export const ahora = () => new Date().toISOString();

/** Cuánto esperar después de un cambio para subirlo (junta varios toques seguidos en una sola subida) */
const ESPERA_PARA_SUBIR = 1500;

export function ProveedorDeInventario({
  dueno,
  enLinea = true,
  alEntrar,
  almacen: dado,
  servidor = graphql,
  children,
}: {
  dueno: string;
  enLinea?: boolean;
  /** Se llama cuando entran compras nuevas (para avisar) */
  alEntrar?: (cuantas: number) => void;
  /** Para las pruebas; si no, el del teléfono */
  almacen?: AlmacenLocal;
  /** Para las pruebas; si no, el Router */
  servidor?: <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;
  children: ReactNode;
}) {
  const almacen = useMemo(() => dado ?? almacenDeNegocio(dueno), [dado, dueno]);
  const [datos, setDatos] = useState<DatosDeNegocio>(datosVacios());
  const [cargando, setCargando] = useState(true);
  const [porSubir, setPorSubir] = useState(0);
  const [nube, setNube] = useState<EstadoDeLaNube>('al-dia');
  // Una cosa a la vez: el Inicio, la pestaña y la subida pueden querer escribir al mismo tiempo
  const cola = useRef<Promise<unknown>>(Promise.resolve());
  const avisarRef = useRef(alEntrar);
  avisarRef.current = alEntrar;
  const servidorRef = useRef(servidor);
  servidorRef.current = servidor;
  const enLineaRef = useRef(enLinea);
  enLineaRef.current = enLinea;
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enCola = useCallback(<T,>(tarea: () => Promise<T>): Promise<T> => {
    const siguiente = cola.current.then(tarea, tarea);
    cola.current = siguiente.catch(() => undefined);
    return siguiente;
  }, []);

  const releer = useCallback(async () => {
    setDatos(await almacen.leer());
    const n = cuantosCambios(await almacen.pendientes());
    setPorSubir(n);
    return n;
  }, [almacen]);

  /** Sube la cola y baja lo nuevo. Sin señal o sin servidor, queda todo en el teléfono para la próxima */
  const sincronizarConElServidor = useCallback(
    () =>
      enCola(async () => {
        if (!enLineaRef.current) {
          setNube('sin-senal');
          return;
        }
        setNube('subiendo');
        try {
          const pendientes = await almacen.pendientes();
          if (cuantosCambios(pendientes)) {
            await servidorRef.current<RespuestaSincronizar>(SINCRONIZAR_MI_NEGOCIO, { cambios: pendientes });
            await almacen.quitarPendientes(pendientes);
          }
          const r = await servidorRef.current<RespuestaMiNegocio>(MI_NEGOCIO, { desde: await almacen.marca() });
          await almacen.aplicarDelServidor(sinMarca(r.miNegocio));
          await almacen.guardarMarca(r.miNegocio.hasta);
          const quedan = await releer();
          setNube(quedan ? 'por-subir' : 'al-dia');
        } catch {
          await releer();
          setNube('error');
        }
      }),
    [almacen, enCola, releer],
  );

  const programarSubida = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => void sincronizarConElServidor(), ESPERA_PARA_SUBIR);
  }, [sincronizarConElServidor]);

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);

  // Al abrir: lo del teléfono al instante y, con señal, lo del servidor (en un celular nuevo, todo)
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    void enCola(async () => {
      await releer();
      if (vivo) setCargando(false);
    }).then(() => {
      if (vivo) void sincronizarConElServidor();
    });
    return () => {
      vivo = false;
    };
  }, [almacen, enCola, releer, sincronizarConElServidor]);

  // Al volver la señal, se sube lo que quedó en la cola
  useEffect(() => {
    if (enLinea) void sincronizarConElServidor();
    else setNube('sin-senal');
  }, [enLinea, sincronizarConElServidor]);

  const aplicar = useCallback(
    (cambios: CambiosDeNegocio) =>
      enCola(async () => {
        if (!cuantosCambios(cambios)) return;
        await almacen.guardar(cambios);
        await releer();
        setNube(enLineaRef.current ? 'por-subir' : 'sin-senal');
        programarSubida();
      }),
    [almacen, enCola, releer, programarSubida],
  );

  const sincronizar = useCallback(
    (pedidos: PedidoComprado[]) =>
      enCola(async () => {
        const antes = await almacen.leer();
        const n = await sincronizarCompras(almacen, pedidos, ahora());
        if (n || (await almacen.leer()).anotaciones.length !== antes.anotaciones.length) {
          await releer();
          programarSubida();
        }
        if (n) avisarRef.current?.(n);
        return n;
      }),
    [almacen, enCola, releer, programarSubida],
  );

  const agregarAMano: EstadoDeInventario['agregarAMano'] = useCallback(
    async (entrada, cantidad, costo) => {
      const articulo = articuloAMano(entrada, ahora(), `mano:${nuevoId()}`);
      await aplicar({ articulos: [articulo], movimientos: [entradaAMano(articulo, cantidad, costo, ahora(), nuevoId())] });
      return articulo;
    },
    [aplicar],
  );

  const sumar: EstadoDeInventario['sumar'] = useCallback(
    (articulo, cantidad, costo) => aplicar({ movimientos: [entradaAMano(articulo, cantidad, costo, ahora(), nuevoId())] }),
    [aplicar],
  );

  const ajustar: EstadoDeInventario['ajustar'] = useCallback(
    async (existencia, contada) => {
      const m = ajusteAMano(existencia, contada, ahora(), nuevoId());
      if (!m) return false;
      await aplicar({ movimientos: [m] });
      return true;
    },
    [aplicar],
  );

  const valor = useMemo(
    () => ({ datos, cargando, nube, porSubir, aplicar, sincronizar, sincronizarAhora: sincronizarConElServidor, agregarAMano, sumar, ajustar }),
    [datos, cargando, nube, porSubir, aplicar, sincronizar, sincronizarConElServidor, agregarAMano, sumar, ajustar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useInventario() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useInventario va dentro de ProveedorDeInventario');
  return c;
}
