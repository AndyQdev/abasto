import {
  agregar,
  CONSULTA_CATALOGO,
  conciliarCarrito,
  conRelacion,
  escalaPorDefecto,
  itemDeCarrito,
  PEDIR_SER_CLIENTE,
  type EstadoRelacion,
  type ItemDeCarrito,
  type Mayorista,
  type Producto,
} from '@abasto/comercio';
import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { graphql } from './api';
import { bandeja } from './bandeja-pedidos';
import { guardado } from './guardado';
import { useSesion } from './sesion';

interface CatalogoGuardado {
  productos: Producto[];
  mayoristas: Mayorista[];
  /** ISO de la última vez que se trajo; sin señal se busca sobre esto */
  actualizado: string | null;
}

interface Estado {
  enLinea: boolean;
  catalogo: CatalogoGuardado & { cargando: boolean; error: string | null; recargar: () => Promise<void> };
  pedirSerCliente: (mayoristaId: string) => Promise<string | null>;
  carrito: ItemDeCarrito[];
  cambiarCarrito: (c: ItemDeCarrito[]) => void;
  /** Agrega al carrito. Con `abrir`, muestra la hoja del carrito con lo agregado resaltado (desde la ficha) */
  agregarAlCarrito: (item: ItemDeCarrito, opciones?: { abrir?: boolean }) => void;
  hojaCarrito: { visible: boolean; resaltado: string | null };
  abrirCarrito: () => void;
  cerrarCarrito: () => void;
  /** Agrega la escala por defecto (una docena) desde una lista */
  agregarRapido: (p: Producto) => void;
  aviso: string | null;
  avisar: (texto: string) => void;
}

const VACIO: CatalogoGuardado = { productos: [], mayoristas: [], actualizado: null };
const Contexto = createContext<Estado | null>(null);

export function ProveedorDeEstado({ children }: { children: ReactNode }) {
  const { usuario } = useSesion();
  const [enLinea, setEnLinea] = useState(true);
  const [catalogo, setCatalogo] = useState<CatalogoGuardado>(VACIO);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [carrito, setCarrito] = useState<ItemDeCarrito[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [hojaCarrito, setHojaCarrito] = useState<{ visible: boolean; resaltado: string | null }>({ visible: false, resaltado: null });
  const reloj = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const avisarRef = useRef<(texto: string) => void>(() => undefined);

  useEffect(() => NetInfo.addEventListener((e) => setEnLinea(e.isConnected !== false && e.isInternetReachable !== false)), []);

  // Lo guardado en el teléfono aparece al instante; después se actualiza desde el servidor
  useEffect(() => {
    void guardado.leer<CatalogoGuardado>('catalogo').then((c) => c && setCatalogo(c));
    void guardado.leer<ItemDeCarrito[]>('carrito').then((c) => c && setCarrito(c));
  }, []);

  const recargar = useCallback(async () => {
    if (!usuario) return;
    setCargando(true);
    try {
      const r = await graphql<{ productos: Producto[]; mayoristas: Mayorista[] }>(CONSULTA_CATALOGO);
      const nuevo = { ...r, actualizado: new Date().toISOString() };
      setCatalogo(nuevo);
      void guardado.escribir('catalogo', nuevo);
      setError(null);
      // El carrito guardado puede tener productos o presentaciones que ya no se venden: se pone al día
      setCarrito((c) => {
        const r = conciliarCarrito(c, nuevo.productos);
        if (!r.cambio) return c;
        void guardado.escribir('carrito', r.carrito);
        if (r.quitados.length) setTimeout(() => avisarRef.current(`Sacamos del carrito lo que ya no se vende así: ${r.quitados.join(', ')}`), 0);
        return r.carrito;
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useEffect(() => {
    if (enLinea && usuario) {
      void recargar();
      // Safari y Android no mandan en segundo plano: al abrir la app y al volver la señal se manda la bandeja
      void bandeja.sincronizar();
    }
  }, [enLinea, usuario, recargar]);

  const avisar = useCallback((texto: string) => {
    setAviso(texto);
    clearTimeout(reloj.current);
    reloj.current = setTimeout(() => setAviso(null), 2500);
  }, []);
  avisarRef.current = avisar;

  const cambiarCarrito = useCallback((c: ItemDeCarrito[]) => {
    setCarrito(c);
    void guardado.escribir('carrito', c);
  }, []);

  // Ya no hay mensaje al agregar (02/11, pedido del usuario): el «+» se anima y la ficha abre la hoja del carrito
  const agregarAlCarrito = useCallback((item: ItemDeCarrito, opciones?: { abrir?: boolean }) => {
    setCarrito((c) => {
      const nuevo = agregar(c, item);
      void guardado.escribir('carrito', nuevo);
      return nuevo;
    });
    if (opciones?.abrir) setHojaCarrito({ visible: true, resaltado: `${item.productoId}-${item.presentacion}` });
  }, []);
  const abrirCarrito = useCallback(() => setHojaCarrito({ visible: true, resaltado: null }), []);
  const cerrarCarrito = useCallback(() => setHojaCarrito((h) => ({ ...h, visible: false })), []);

  const cambiarRelacion = useCallback((mayoristaId: string, relacion: EstadoRelacion) => {
    setCatalogo((d) => {
      const nuevo = {
        ...d,
        productos: conRelacion(d.productos, mayoristaId, relacion),
        mayoristas: d.mayoristas.map((m) => (m.id === mayoristaId ? { ...m, relacion } : m)),
      };
      void guardado.escribir('catalogo', nuevo);
      return nuevo;
    });
  }, []);

  const valor = useMemo<Estado>(
    () => ({
      enLinea,
      catalogo: { ...catalogo, cargando, error, recargar },
      pedirSerCliente: async (mayoristaId) => {
        if (!enLinea) return 'Necesitas conexión para pedir ser cliente.';
        try {
          const r = await graphql<{ pedirSerCliente: { estado: EstadoRelacion } }>(PEDIR_SER_CLIENTE, { id: mayoristaId });
          cambiarRelacion(mayoristaId, r.pedirSerCliente.estado);
          return null;
        } catch (e) {
          return (e as Error).message;
        }
      },
      carrito,
      cambiarCarrito,
      agregarAlCarrito,
      agregarRapido: (p) => {
        const escala = escalaPorDefecto(p);
        if (escala) agregarAlCarrito(itemDeCarrito(p, escala));
      },
      hojaCarrito,
      abrirCarrito,
      cerrarCarrito,
      aviso,
      avisar,
    }),
    [enLinea, catalogo, cargando, error, recargar, cambiarRelacion, carrito, cambiarCarrito, agregarAlCarrito, hojaCarrito, abrirCarrito, cerrarCarrito, aviso, avisar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useEstado(): Estado {
  const e = useContext(Contexto);
  if (!e) throw new Error('useEstado fuera de ProveedorDeEstado');
  return e;
}
