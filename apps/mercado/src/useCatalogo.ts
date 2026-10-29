import { useCallback, useEffect, useState } from 'react';
import { CONSULTA_CATALOGO, PEDIR_SER_CLIENTE, conRelacion, type EstadoRelacion, type Mayorista, type Producto } from './catalogo';
import { graphql, guardado } from './servicios';

interface Guardado {
  productos: Producto[];
  mayoristas: Mayorista[];
  /** ISO de la última vez que se trajo de Catálogo */
  actualizado: string | null;
}

const VACIO: Guardado = { productos: [], mayoristas: [], actualizado: null };

/**
 * Trae el catálogo una vez y lo guarda en el teléfono: la búsqueda se hace sobre lo guardado,
 * así anda igual con o sin señal («Buscas en tu catálogo guardado del 20/10/2026»).
 */
export function useCatalogo(enLinea: boolean) {
  const [datos, setDatos] = useState<Guardado>(() => guardado.leer<Guardado>('catalogo') ?? VACIO);
  const [cargando, setCargando] = useState(enLinea);
  const [error, setError] = useState<string | null>(null);

  const traer = useCallback(
    () =>
      graphql<{ productos: Producto[]; mayoristas: Mayorista[] }>(CONSULTA_CATALOGO)
        .then((r) => {
          const nuevo = { ...r, actualizado: new Date().toISOString() };
          setDatos(nuevo);
          guardado.escribir('catalogo', nuevo);
          setError(null);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setCargando(false)),
    [],
  );

  // Al abrir la app y cada vez que vuelve la señal
  useEffect(() => {
    if (enLinea) void traer();
  }, [enLinea, traer]);

  const recargar = useCallback(async () => {
    if (!enLinea) return;
    setCargando(true);
    await traer();
  }, [enLinea, traer]);

  const cambiarRelacion = useCallback((mayoristaId: string, relacion: EstadoRelacion) => {
    setDatos((d) => {
      const nuevo = {
        ...d,
        productos: conRelacion(d.productos, mayoristaId, relacion),
        mayoristas: d.mayoristas.map((m) => (m.id === mayoristaId ? { ...m, relacion } : m)),
      };
      guardado.escribir('catalogo', nuevo);
      return nuevo;
    });
  }, []);

  /** Devuelve el mensaje de error, o null si salió bien */
  const pedirSerCliente = useCallback(
    async (mayoristaId: string): Promise<string | null> => {
      if (!enLinea) return 'Necesitas conexión para pedir ser cliente.';
      try {
        const r = await graphql<{ pedirSerCliente: { estado: EstadoRelacion } }>(PEDIR_SER_CLIENTE, { id: mayoristaId });
        cambiarRelacion(mayoristaId, r.pedirSerCliente.estado);
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
    [enLinea, cambiarRelacion],
  );

  return { ...datos, cargando, error, recargar, pedirSerCliente };
}

export type Catalogo = ReturnType<typeof useCatalogo>;
