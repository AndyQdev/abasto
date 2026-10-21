import { filtrar, filtrarMayoristas, nombreCorto, opcionesDeCompra, ordenarMayoristas, rubros, textoDeStock, type Producto } from '../catalogo';
import { BotonAgregar, Foto, Iniciales, InsigniaRelacion, SinPrecio, type Navegar } from '../componentes';
import { Icono } from '../Icono';
import type { Catalogo } from '../useCatalogo';

export interface EstadoBusqueda {
  texto: string;
  rubro: string | null;
  modo: 'productos' | 'mayoristas';
}

interface Props {
  catalogo: Catalogo;
  enLinea: boolean;
  estado: EstadoBusqueda;
  alCambiar: (e: EstadoBusqueda) => void;
  ir: Navegar;
}

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Busca sobre el catálogo guardado en el teléfono, con o sin señal.
 * No hay orden por precio: la red es privada y no se comparan mayoristas.
 */
export function Buscar({ catalogo, enLinea, estado, alCambiar, ir }: Props) {
  const { texto, rubro, modo } = estado;
  const cambiar = (parcial: Partial<EstadoBusqueda>) => alCambiar({ ...estado, ...parcial });
  const productos = filtrar(catalogo.productos, { texto, rubro });
  const mayoristas = ordenarMayoristas(filtrarMayoristas(catalogo.mayoristas, texto));
  const resultados = modo === 'productos' ? productos.length : mayoristas.length;

  return (
    <div className="pantalla buscar">
      <form className="buscador-fila" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="buscador-caja">
          <label htmlFor="q" className="oculto">
            Buscar productos o mayoristas
          </label>
          <Icono nombre="buscar" />
          <input
            id="q"
            type="search"
            autoComplete="off"
            value={texto}
            placeholder="Buscar productos o mayoristas..."
            onChange={(e) => cambiar({ texto: e.target.value })}
          />
          {texto && (
            <button type="button" aria-label="Borrar búsqueda" onClick={() => cambiar({ texto: '' })}>
              <Icono nombre="borrar" tamano={18} />
            </button>
          )}
        </div>
      </form>

      <div role="group" aria-label="Buscar en" className="segmentado">
        <button type="button" className="chip" aria-pressed={modo === 'productos'} onClick={() => cambiar({ modo: 'productos' })}>
          Productos
        </button>
        <button type="button" className="chip" aria-pressed={modo === 'mayoristas'} onClick={() => cambiar({ modo: 'mayoristas' })}>
          Mayoristas
        </button>
      </div>

      {modo === 'productos' && (
        <div role="group" aria-label="Rubro" className="scroll-x">
          <button type="button" className="chip" aria-pressed={!rubro} onClick={() => cambiar({ rubro: null })}>
            Todos
          </button>
          {rubros(catalogo.productos).map((r) => (
            <button key={r} type="button" className="chip" aria-pressed={rubro === r} onClick={() => cambiar({ rubro: r })}>
              {r}
            </button>
          ))}
        </div>
      )}

      <span className="gris">
        <strong className="texto">{resultados}</strong> {resultados === 1 ? 'resultado' : 'resultados'}
      </span>
      {!enLinea && catalogo.actualizado && (
        <span className="ins ins-ambar">Buscas en tu catálogo guardado del {fecha(catalogo.actualizado)}</span>
      )}

      {modo === 'productos' && (
        <div className="lista">
          {productos.map((p) => (
            <Resultado key={p.id} producto={p} ir={ir} />
          ))}
          {!productos.length && (
            <div className="tarj vacio-tarj">
              <strong className="tit t3">No encontramos productos</strong>
              <span className="gris">Prueba con otra palabra o quita algún filtro.</span>
              <button type="button" className="btn-chico" onClick={() => alCambiar({ texto: '', rubro: null, modo })}>
                Quitar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {modo === 'mayoristas' && (
        <div className="lista">
          {mayoristas.map((m) => (
            <button key={m.id} type="button" className="tarj fila mayorista-fila" onClick={() => ir.mayorista(m.id)}>
              <Iniciales nombre={m.nombre} clase="grande" />
              <span className="crece">
                <strong>{m.nombre}</strong>
                <span className="gris">{m.ciudad}</span>
                <span className="insignias">
                  {m.verificado && <span className="ins ins-verde">Verificado</span>}
                  <InsigniaRelacion relacion={m.relacion} />
                </span>
              </span>
              <Icono nombre="seguir" />
            </button>
          ))}
          {!mayoristas.length && <p className="vacio">No encontramos mayoristas con ese nombre.</p>}
        </div>
      )}
    </div>
  );
}

function Resultado({ producto: p, ir }: { producto: Producto; ir: Navegar }) {
  const opciones = opcionesDeCompra(p);
  const stock = textoDeStock(p);
  return (
    <div className="tarj resultado">
      <Foto producto={p} clase="foto-resultado" alAbrir={() => ir.producto(p.id)} />
      <div className="crece">
        <button type="button" className="nombre" onClick={() => ir.producto(p.id)}>
          <strong>{p.nombre}</strong>
          <span className="gris">{p.rubro}</span>
        </button>
        <button type="button" className="enlace-mayorista" onClick={() => ir.mayorista(p.mayorista.id)}>
          <Icono nombre="tienda" tamano={14} />
          {nombreCorto(p.mayorista.nombre)}
        </button>
        {opciones.length ? (
          <>
            <div className="escalas">
              <div className="escalas-precios">
                {opciones.map((o) => (
                  <span key={o.presentacion}>
                    <span className="gris chico">{o.nombre}</span>
                    <span className="precio">{o.precioUnitario}</span>
                  </span>
                ))}
              </div>
              <BotonAgregar producto={p} alAgregar={ir.agregar} />
            </div>
            <span className="gris chico">Precio por unidad · {stock.texto}</span>
          </>
        ) : (
          <SinPrecio />
        )}
      </div>
    </div>
  );
}
