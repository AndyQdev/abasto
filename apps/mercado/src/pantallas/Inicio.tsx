import { comprables, nombreCorto, ordenarMayoristas, precioDesde, rubros, type Producto } from '../catalogo';
import { bs } from '../carrito';
import { BotonAgregar, Foto, Iniciales, InsigniaRelacion, SinPrecio, type Navegar } from '../componentes';
import { Icono } from '../Icono';
import type { Catalogo } from '../useCatalogo';

interface Props {
  catalogo: Catalogo;
  ir: Navegar;
}

/** Inicio según la maqueta: buscador, rubros, productos de mis mayoristas, mayoristas y ofertas por caja. */
export function Inicio({ catalogo, ir }: Props) {
  const productos = comprables(catalogo.productos);
  // Primero lo que la tienda puede comprar ya (mayoristas que la aprobaron)
  const destacados = [...productos].sort((a, b) => Number(b.precioVisible) - Number(a.precioVisible)).slice(0, 8);
  const ofertas = productos.filter((p) => p.precioVisible && p.escalas.some((e) => e.presentacion === 'CAJA')).slice(0, 4);
  const mayoristas = ordenarMayoristas(catalogo.mayoristas);
  const cuantos = (id: string) => productos.filter((p) => p.mayorista.id === id).length;

  return (
    <div className="pantalla inicio">
      <button type="button" className="buscador-falso" onClick={() => ir.buscar()}>
        <Icono nombre="buscar" />
        <span>Buscar productos o mayoristas...</span>
      </button>

      <section className="portada">
        <div className="portada-cajas" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h2 className="tit">Precios de mayoreo para tu tienda</h2>
        <p>Compra directo de los mayoristas que te aprobaron como cliente</p>
        <button type="button" onClick={() => ir.buscar()}>
          Ver el catálogo <Icono nombre="seguir" tamano={16} />
        </button>
      </section>

      {catalogo.error && <p className="falla">{catalogo.error}</p>}

      <div role="group" aria-label="Categorías" className="scroll-x">
        {rubros(catalogo.productos).map((r) => (
          <button key={r} type="button" className="chip" onClick={() => ir.buscar({ rubro: r })}>
            {r}
          </button>
        ))}
      </div>

      <section className="seccion">
        <div className="seccion-cabeza">
          <h2 className="tit t2">Productos destacados</h2>
          <button type="button" className="enlace" onClick={() => ir.buscar()}>
            Ver todos
          </button>
        </div>
        {!destacados.length && <p className="vacio">{catalogo.cargando ? 'Cargando el catálogo…' : 'Todavía no hay productos para mostrar.'}</p>}
        <div className="scroll-x">
          {destacados.map((p) => (
            <Destacado key={p.id} producto={p} ir={ir} />
          ))}
        </div>
      </section>

      <section className="seccion">
        <div className="seccion-cabeza">
          <h2 className="tit t2">Mayoristas</h2>
          <button type="button" className="enlace" onClick={() => ir.buscar({ modo: 'mayoristas' })}>
            Ver todos
          </button>
        </div>
        <div className="scroll-x">
          {mayoristas.map((m) => (
            <button key={m.id} type="button" className="tarj mayorista-chico" onClick={() => ir.mayorista(m.id)}>
              <span className="fila-chica">
                <Iniciales nombre={m.nombre} />
                <strong>{m.nombre}</strong>
              </span>
              <span className="gris">
                {m.ciudad} · {cuantos(m.id)} productos
              </span>
              <span className="insignias">
                {m.verificado && <span className="ins ins-verde">Verificado</span>}
                <InsigniaRelacion relacion={m.relacion} />
              </span>
            </button>
          ))}
        </div>
      </section>

      {ofertas.length > 0 && (
        <section className="seccion">
          <h2 className="tit t2">Ofertas por caja</h2>
          {ofertas.map((p) => {
            const caja = p.escalas.find((e) => e.presentacion === 'CAJA')!;
            return (
              <button key={p.id} type="button" className="tarj fila oferta" onClick={() => ir.producto(p.id)}>
                <Foto producto={p} clase="foto-56" />
                <span className="crece">
                  <strong>{p.nombre}</strong>
                  <span className="gris">
                    {nombreCorto(p.mayorista.nombre)} · caja de {caja.cantidad} u.
                  </span>
                </span>
                <span className="derecha">
                  <span className="precio">{bs((caja.precioUnitario?.centavos ?? 0) * caja.cantidad)}</span>
                  <span className="gris chico">{caja.precioUnitario?.texto} c/u</span>
                </span>
              </button>
            );
          })}
        </section>
      )}
    </div>
  );
}

function Destacado({ producto: p, ir }: { producto: Producto; ir: Navegar }) {
  const desde = precioDesde(p);
  return (
    <div className="tarj destacado">
      <Foto producto={p} clase="foto-destacado" alAbrir={() => ir.producto(p.id)} />
      <button type="button" className="nombre" onClick={() => ir.producto(p.id)}>
        {p.nombre}
      </button>
      <span className="gris">{nombreCorto(p.mayorista.nombre)}</span>
      <div className="pie-destacado">
        {desde ? (
          <>
            <span className="desde">
              <span className="gris chico">desde</span>
              <span className="precio">{desde.precioUnitario!.texto}</span>
              <span className="gris chico">c/u por {desde.presentacion.toLowerCase()}</span>
            </span>
            <BotonAgregar producto={p} alAgregar={ir.agregar} />
          </>
        ) : (
          <SinPrecio />
        )}
      </div>
    </div>
  );
}
