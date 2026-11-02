import {
  ajusteAMano,
  articuloAMano,
  entradaAMano,
  sincronizarCompras,
  type AlmacenDeNegocio,
  type Articulo,
  type ClaseDeArticulo,
  type DatosDeNegocio,
  type Existencia,
  type Medida,
  type PedidoComprado,
} from '@abasto/comercio';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { almacenDeNegocio } from './almacen-negocio';

/**
 * El inventario de «Mi negocio» (Fase 2 de docs/plan-mi-negocio.md). Lo que se compra en Abasto entra solo cuando el
 * pedido llega a ENTREGADO (`sincronizar`, que llaman el Inicio y la pestaña al leer `misCompras`); lo de otros
 * proveedores y lo que se cuenta se agrega a mano. Todo queda en el teléfono y anda sin señal.
 */
interface EstadoDeInventario {
  datos: DatosDeNegocio;
  cargando: boolean;
  /** Registra lo entregado que falta. Devuelve cuántas líneas entraron */
  sincronizar: (pedidos: PedidoComprado[]) => Promise<number>;
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

const nuevoId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const ahora = () => new Date().toISOString();

export function ProveedorDeInventario({
  dueno,
  alEntrar,
  almacen: dado,
  children,
}: {
  dueno: string;
  /** Se llama cuando entran compras nuevas (para avisar) */
  alEntrar?: (cuantas: number) => void;
  /** Para las pruebas; si no, el del teléfono */
  almacen?: AlmacenDeNegocio;
  children: ReactNode;
}) {
  const almacen = useMemo(() => dado ?? almacenDeNegocio(dueno), [dado, dueno]);
  const [datos, setDatos] = useState<DatosDeNegocio>({ articulos: [], movimientos: [] });
  const [cargando, setCargando] = useState(true);
  // Una cosa a la vez: el Inicio y la pestaña pueden sincronizar al mismo tiempo
  const cola = useRef<Promise<unknown>>(Promise.resolve());
  const avisarRef = useRef(alEntrar);
  avisarRef.current = alEntrar;

  const enCola = useCallback(<T,>(tarea: () => Promise<T>): Promise<T> => {
    const siguiente = cola.current.then(tarea, tarea);
    cola.current = siguiente.catch(() => undefined);
    return siguiente;
  }, []);

  const releer = useCallback(async () => setDatos(await almacen.leer()), [almacen]);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    void enCola(async () => {
      const d = await almacen.leer();
      if (vivo) {
        setDatos(d);
        setCargando(false);
      }
    });
    return () => {
      vivo = false;
    };
  }, [almacen, enCola]);

  const sincronizar = useCallback(
    (pedidos: PedidoComprado[]) =>
      enCola(async () => {
        const n = await sincronizarCompras(almacen, pedidos, ahora());
        if (n) {
          await releer();
          avisarRef.current?.(n);
        }
        return n;
      }),
    [almacen, enCola, releer],
  );

  const agregarAMano: EstadoDeInventario['agregarAMano'] = useCallback(
    (entrada, cantidad, costo) =>
      enCola(async () => {
        const articulo = articuloAMano(entrada, ahora(), `mano:${nuevoId()}`);
        const movimiento = entradaAMano(articulo, cantidad, costo, ahora(), nuevoId());
        await almacen.guardar({ articulos: [articulo], movimientos: [movimiento] });
        await releer();
        return articulo;
      }),
    [almacen, enCola, releer],
  );

  const sumar: EstadoDeInventario['sumar'] = useCallback(
    (articulo, cantidad, costo) =>
      enCola(async () => {
        await almacen.guardar({ movimientos: [entradaAMano(articulo, cantidad, costo, ahora(), nuevoId())] });
        await releer();
      }),
    [almacen, enCola, releer],
  );

  const ajustar: EstadoDeInventario['ajustar'] = useCallback(
    (existencia, contada) =>
      enCola(async () => {
        const m = ajusteAMano(existencia, contada, ahora(), nuevoId());
        if (!m) return false;
        await almacen.guardar({ movimientos: [m] });
        await releer();
        return true;
      }),
    [almacen, enCola, releer],
  );

  const valor = useMemo(() => ({ datos, cargando, sincronizar, agregarAMano, sumar, ajustar }), [datos, cargando, sincronizar, agregarAMano, sumar, ajustar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useInventario() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useInventario va dentro de ProveedorDeInventario');
  return c;
}
