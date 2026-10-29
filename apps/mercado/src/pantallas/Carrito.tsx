import { bs, cambiarCantidad, nombreDe, porMayorista, quitar, totalDe, unidadesDe, type ItemDeCarrito } from '../carrito';
import { nombreCorto, tinte } from '../catalogo';
import { Iniciales } from '../componentes';
import { Icono } from '../Icono';
import { productos } from '../pedidos';

interface Props {
  carrito: ItemDeCarrito[];
  enLinea: boolean;
  alCambiar: (carrito: ItemDeCarrito[]) => void;
  alContinuar: () => void;
  alBuscar: () => void;
  alAbrirProducto: (id: string) => void;
}

/** El carrito vive en el teléfono: se puede cambiar sin señal. Sale un pedido por mayorista. */
export function Carrito({ carrito, enLinea, alCambiar, alContinuar, alBuscar, alAbrirProducto }: Props) {
  const grupos = porMayorista(carrito);
  const total = grupos.reduce((s, g) => s + g.totalEstimadoCentavos, 0);
  const unidades = carrito.reduce((s, i) => s + unidadesDe(i), 0);

  return (
    <div className="pantalla">
      <div className="entre">
        <h1 className="tit t1">Tu carrito ({carrito.length})</h1>
        {carrito.length > 0 && (
          <button type="button" className="enlace peligro" onClick={() => alCambiar([])}>
            Vaciar
          </button>
        )}
      </div>
      {!enLinea && <span className="ins ins-ambar">Puedes cambiar tu carrito sin señal</span>}

      {!carrito.length && (
        <div className="tarj vacio-tarj">
          <strong className="tit t2">Tu carrito está vacío</strong>
          <span className="gris">Busca productos y agrégalos por cuarta, docena o caja.</span>
          <button type="button" className="btn-chico" onClick={alBuscar}>
            Buscar productos
          </button>
        </div>
      )}

      {grupos.map((g) => (
        <section key={g.mayoristaId} className="tarj grupo-carrito" aria-label={`Productos de ${g.mayoristaNombre}`}>
          <div className="fila-chica">
            <Iniciales nombre={g.mayoristaNombre} />
            <span className="crece">
              <strong className="tit t3">{g.mayoristaNombre}</strong>
              <span className="gris">Pedido aparte</span>
            </span>
          </div>
          {g.items.map((i) => (
            <div key={`${i.productoId}-${i.presentacion}`} className="item-carrito">
              <button type="button" className={`foto foto-58 ${tinte('')}`} aria-label={`Ver ${i.nombre}`} onClick={() => alAbrirProducto(i.productoId)}>
                <Icono nombre="caja" tamano={22} />
              </button>
              <div className="crece">
                <div className="entre arriba">
                  <span className="crece">
                    <strong>{i.nombre}</strong>
                    <span className="gris">
                      {nombreDe(i.presentacion)} · {i.precioUnitarioCentavos ? `${bs(i.precioUnitarioCentavos)} c/u` : 'precio al reservar'}
                    </span>
                  </span>
                  <span className="derecha">
                    <strong className="num">{bs(totalDe(i))}</strong>
                    <span className="gris">{unidadesDe(i)} u.</span>
                  </span>
                </div>
                <div className="entre">
                  <div role="group" aria-label={`Cantidad de ${i.nombre}`} className="contador chico">
                    <button
                      type="button"
                      className="paso"
                      aria-label="Quitar uno"
                      disabled={i.cantidad <= 1}
                      onClick={() => alCambiar(cambiarCantidad(carrito, i.productoId, i.presentacion, -1))}
                    >
                      <Icono nombre="menos" tamano={16} />
                    </button>
                    <span className="num">{i.cantidad}</span>
                    <button type="button" className="paso" aria-label="Agregar uno" onClick={() => alCambiar(cambiarCantidad(carrito, i.productoId, i.presentacion, 1))}>
                      <Icono nombre="mas" tamano={16} />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="paso peligro"
                    aria-label={`Eliminar ${i.nombre}`}
                    onClick={() => alCambiar(quitar(carrito, i.productoId, i.presentacion))}
                  >
                    <Icono nombre="borrar" tamano={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <div className="entre pie-grupo">
            <span className="texto-2">Subtotal {nombreCorto(g.mayoristaNombre)}</span>
            <strong className="num">{bs(g.totalEstimadoCentavos)}</strong>
          </div>
        </section>
      ))}

      {carrito.length > 0 && (
        <>
          <section className="tarj resumen">
            <div className="entre">
              <span className="texto-2">
                {productos(carrito.length)} · {unidades} u.
              </span>
              <span className="num">{bs(total)}</span>
            </div>
            <div className="sep" />
            <div className="entre">
              <strong>Total estimado</strong>
              <strong className="tit num total-grande">{bs(total)}</strong>
            </div>
            <span className="gris">
              {grupos.length === 1 ? '1 pedido.' : `${grupos.length} pedidos: uno por cada mayorista.`} El precio final lo confirma cada mayorista al reservar.
            </span>
          </section>
          <button type="button" className="btn" onClick={alContinuar}>
            Continuar pedido
          </button>
        </>
      )}
    </div>
  );
}
