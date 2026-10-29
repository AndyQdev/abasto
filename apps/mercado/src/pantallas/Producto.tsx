import { useState } from 'react';
import { disponible, escalaPorDefecto, escalasConPrecio, itemDeCarrito, opcionesDeCompra, textoDeStock, type Producto as P } from '../catalogo';
import { bs, cantidadDe, type ItemDeCarrito } from '../carrito';
import { Foto, PedirSerCliente, type Navegar } from '../componentes';
import { Icono } from '../Icono';

interface Props {
  producto: P;
  enLinea: boolean;
  ir: Navegar;
  alVolver: () => void;
  alAgregar: (item: ItemDeCarrito) => void;
  alPedirSerCliente: (mayoristaId: string) => Promise<string | null>;
}

/** Detalle con los precios por volumen (cuarta, docena y caja) de la lista de la tienda. */
export function Producto({ producto: p, enLinea, ir, alVolver, alAgregar, alPedirSerCliente }: Props) {
  const opciones = opcionesDeCompra(p);
  const [presentacion, setPresentacion] = useState(escalaPorDefecto(p)?.presentacion ?? null);
  const [cantidad, setCantidad] = useState(1);
  const elegida = opciones.find((o) => o.presentacion === presentacion);
  const escala = escalasConPrecio(p).find((e) => e.presentacion === presentacion);
  const stock = textoDeStock(p);
  const sinStock = !disponible(p);

  return (
    <div className="detalle">
      <div className="detalle-foto">
        <Foto producto={p} clase="foto-portada" />
        <button type="button" className="ico flotante izquierda" aria-label="Volver" onClick={alVolver}>
          <Icono nombre="volver" />
        </button>
      </div>

      <div className="detalle-cuerpo">
        <div className="detalle-cabeza">
          <h1 className="tit t1">{p.nombre}</h1>
          <span className="texto-2">
            {p.rubro} · <span className="mono">{p.codigo}</span>
          </span>
          <div className="entre">
            <button type="button" className="enlace-mayorista grande" onClick={() => ir.mayorista(p.mayorista.id)}>
              <Icono nombre="tienda" tamano={16} />
              {p.mayorista.nombre}
              <Icono nombre="seguir" tamano={16} />
            </button>
            <span className={`ins ${stock.clase}`}>{stock.texto}</span>
          </div>
        </div>

        {opciones.length > 0 ? (
          <section aria-labelledby="t-vol" className="tarj volumen">
            <h2 id="t-vol" className="tit t3">
              Precios por volumen
            </h2>
            <div role="group" aria-label="Presentación" className="opciones">
              {opciones.map((o) => (
                <button
                  key={o.presentacion}
                  type="button"
                  className="opcion"
                  aria-pressed={o.presentacion === presentacion}
                  onClick={() => setPresentacion(o.presentacion)}
                >
                  <span className="opcion-nombre">{o.nombre}</span>
                  <span className="precio">{o.precioUnitario}</span>
                  <span className="gris chico">c/u · {o.unidades} u.</span>
                  <strong className="chico">{o.total}</strong>
                  <span className={`ins ${o.ahorra ? 'ins-verde' : 'ins-gris'} mini`}>{o.ahorro}</span>
                </button>
              ))}
            </div>
            {elegida && (
              <div className="entre">
                <div role="group" aria-label="Cantidad" className="contador">
                  <button type="button" className="paso" aria-label="Quitar uno" disabled={cantidad <= 1} onClick={() => setCantidad((c) => c - 1)}>
                    <Icono nombre="menos" />
                  </button>
                  <span className="num">{cantidad}</span>
                  <button type="button" className="paso" aria-label="Agregar uno" onClick={() => setCantidad((c) => c + 1)}>
                    <Icono nombre="mas" />
                  </button>
                </div>
                <span className="derecha">
                  <strong>{cantidadDe(elegida.presentacion, cantidad)}</strong>
                  <span className="gris">{elegida.unidades * cantidad} u. en total</span>
                </span>
              </div>
            )}
          </section>
        ) : (
          <PedirSerCliente
            mayorista={p.mayorista}
            enLinea={enLinea}
            alPedir={alPedirSerCliente}
            titulo="Pide ser cliente para ver precios"
            detalle={`${p.mayorista.nombre} muestra sus precios por cuarta, docena y caja a las tiendas que aprueba.`}
          />
        )}

        {p.descripcion && (
          <section className="seccion">
            <h2 className="tit t3">Descripción</h2>
            <p className="texto-2">{p.descripcion}</p>
          </section>
        )}
      </div>

      {elegida && escala && (
        <div className="barra-compra">
          <button
            type="button"
            className="btn"
            disabled={sinStock}
            onClick={() => {
              alAgregar(itemDeCarrito(p, escala, cantidad));
              setCantidad(1);
            }}
          >
            {sinStock ? 'Sin stock por ahora' : `Agregar al carrito · ${bs(elegida.totalCentavos * cantidad)}`}
          </button>
        </div>
      )}
    </div>
  );
}
