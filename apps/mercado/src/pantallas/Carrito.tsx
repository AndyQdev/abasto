import { useState } from 'react';
import { bs, cantidadConUnidad, porMayorista, quitar, type ItemDeCarrito } from '../carrito';
import { bandeja } from '../servicios';

interface Props {
  carrito: ItemDeCarrito[];
  enLinea: boolean;
  alCambiar: (carrito: ItemDeCarrito[]) => void;
  alTerminar: () => void;
}

/**
 * Finalizar no llama al servidor: deja un pedido por mayorista en la bandeja offline, cada uno con su clave.
 * Con señal la bandeja lo manda enseguida; sin señal, cuando vuelva.
 */
export function Carrito({ carrito, enLinea, alCambiar, alTerminar }: Props) {
  const [metodoPago, setMetodoPago] = useState<'QR' | 'CREDITO'>('QR');
  const pedidos = porMayorista(carrito);

  async function finalizar() {
    for (const p of pedidos) {
      await bandeja.agregar('pedido.crear', {
        mayoristaId: p.mayoristaId,
        metodoPago,
        lineas: p.items.map((i) => ({ productoId: i.productoId, presentacion: i.presentacion, cantidad: i.cantidad })),
      });
    }
    alCambiar([]);
    if (enLinea) void bandeja.sincronizar();
    alTerminar();
  }

  if (!carrito.length) {
    return (
      <section className="pantalla">
        <h1 className="titulo-pantalla">Tu carrito</h1>
        <p className="vacio">Tu carrito está vacío.</p>
      </section>
    );
  }

  return (
    <section className="pantalla">
      <h1 className="titulo-pantalla">Tu carrito</h1>
      <p className="gris">Puedes cambiar tu carrito sin señal.</p>

      {pedidos.map((p) => (
        <div key={p.mayoristaId} className="carta grupo">
          <strong>{p.mayoristaNombre}</strong>
          <span className="gris">Pedido aparte</span>
          {p.items.map((i) => (
            <div key={`${i.productoId}-${i.presentacion}`} className="item">
              <div>
                {i.nombre}
                <span className="unitario">{cantidadConUnidad(i)}</span>
              </div>
              <button className="boton-secundario" onClick={() => alCambiar(quitar(carrito, i.productoId, i.presentacion))}>
                Quitar
              </button>
            </div>
          ))}
          <div className="item total">
            <span>Total estimado</span>
            <strong>{bs(p.totalEstimadoCentavos)}</strong>
          </div>
        </div>
      ))}

      <fieldset className="carta metodo">
        <legend className="titulo-seccion">Método de pago</legend>
        <label>
          <input type="radio" checked={metodoPago === 'QR'} onChange={() => setMetodoPago('QR')} /> Pago por QR
        </label>
        <label>
          <input type="radio" checked={metodoPago === 'CREDITO'} onChange={() => setMetodoPago('CREDITO')} /> Crédito con
          el mayorista <span className="gris">Sujeto a aprobación del mayorista</span>
        </label>
      </fieldset>

      <button className="boton-primario ancho" onClick={() => void finalizar()}>
        {enLinea ? 'Finalizar pedido' : 'Guardar pedido · se enviará cuando vuelva la señal'}
      </button>
    </section>
  );
}
