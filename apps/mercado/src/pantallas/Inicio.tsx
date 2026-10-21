import { useEffect, useState } from 'react';
import type { ItemDeCarrito, Presentacion } from '../carrito';
import { bs } from '../carrito';
import { graphql, guardado } from '../servicios';

export interface Producto {
  id: string;
  nombre: string;
  rubro: string;
  precioVisible: boolean;
  mayorista: { id: string; nombre: string; verificado: boolean; relacion: 'NINGUNA' | 'SOLICITADA' | 'APROBADA' | 'RECHAZADA' };
  escalas: { presentacion: Presentacion; cantidad: number; precioUnitario: { centavos: number; texto: string } | null }[];
}

// Red privada: el precio llega solo si el mayorista aprobó a esta tienda como cliente
const PRODUCTOS = `
  query Productos($busqueda: String) {
    productos(busqueda: $busqueda) {
      id nombre rubro precioVisible
      mayorista { id nombre verificado relacion }
      escalas { presentacion cantidad precioUnitario { centavos texto } }
    }
  }`;

interface Props {
  enLinea: boolean;
  alAgregar: (item: ItemDeCarrito) => void;
}

export function Inicio({ enLinea, alAgregar }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [productos, setProductos] = useState<Producto[]>(() => guardado.leer<Producto[]>('productos') ?? []);
  const [error, setError] = useState<string | null>(null);
  const [solicitados, setSolicitados] = useState<Set<string>>(new Set());

  async function cargar(texto = busqueda) {
    if (!enLinea) return; // sin señal se muestra lo guardado
    try {
      const datos = await graphql<{ productos: Producto[] }>(PRODUCTOS, { busqueda: texto || null });
      setProductos(datos.productos);
      if (!texto) guardado.escribir('productos', datos.productos);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void cargar('');
  }, [enLinea]);

  async function pedirSerCliente(mayoristaId: string) {
    await graphql(`mutation($id: ID!) { pedirSerCliente(mayoristaId: $id) { estado } }`, { id: mayoristaId });
    setSolicitados((s) => new Set(s).add(mayoristaId));
  }

  return (
    <section className="pantalla">
      <form
        className="busqueda"
        onSubmit={(e) => {
          e.preventDefault();
          void cargar();
        }}
      >
        <input
          className="entrada buscador"
          placeholder="Buscar productos o mayoristas…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </form>

      <h2 className="titulo-seccion">Precios de mayoreo para tu tienda</h2>
      {error && <p className="falla">{error}</p>}
      {!productos.length && !error && <p className="vacio">Todavía no hay productos para mostrar.</p>}

      <div className="productos">
        {productos.map((p) => {
          const caja = p.escalas.find((e) => e.presentacion === 'CAJA') ?? p.escalas[p.escalas.length - 1];
          const solicitado = solicitados.has(p.mayorista.id) || p.mayorista.relacion === 'SOLICITADA';
          return (
            <article key={p.id} className="carta producto">
              <div className="foto" aria-hidden="true" />
              <strong>{p.nombre}</strong>
              <span className="gris">
                {p.mayorista.nombre}
                {p.mayorista.verificado && ' · Verificado'}
              </span>
              {p.precioVisible && caja?.precioUnitario ? (
                <>
                  <span className="precio">{caja.precioUnitario.texto}</span>
                  <span className="unitario">c/u por {caja.presentacion.toLowerCase()} ({caja.cantidad} u.)</span>
                  <button
                    className="boton-primario"
                    onClick={() =>
                      alAgregar({
                        productoId: p.id,
                        nombre: p.nombre,
                        mayoristaId: p.mayorista.id,
                        mayoristaNombre: p.mayorista.nombre,
                        presentacion: caja.presentacion,
                        cantidad: 1,
                        unidadesPorPresentacion: caja.cantidad,
                        precioUnitarioCentavos: caja.precioUnitario?.centavos ?? null,
                      })
                    }
                  >
                    Agregar · {bs((caja.precioUnitario?.centavos ?? 0) * caja.cantidad)}
                  </button>
                </>
              ) : (
                <>
                  <span className="sin-precio">Pide ser cliente para ver precios</span>
                  <button className="boton-secundario" disabled={solicitado || !enLinea} onClick={() => void pedirSerCliente(p.mayorista.id)}>
                    {solicitado ? 'Solicitud enviada · por confirmar' : 'Pedir ser cliente'}
                  </button>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
