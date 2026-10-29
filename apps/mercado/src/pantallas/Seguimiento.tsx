import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { nombreDe, type Presentacion } from '../carrito';
import { tinte } from '../catalogo';
import { Iniciales } from '../componentes';
import { Icono } from '../Icono';
import {
  compensaciones,
  enCurso,
  estadoVisible,
  fechaHora,
  lineaDeTiempo,
  PAGAR_QR_DE_PRUEBA,
  porPagar,
  productos,
  tiempoRestante,
  UN_PEDIDO,
  type Pedido,
} from '../pedidos';
import { graphql } from '../servicios';

interface Props {
  pedidoId: string;
  enLinea: boolean;
  alVolver: () => void;
}

/** Un pedido y su saga, paso a paso. Mientras se mueve, se vuelve a pedir cada 2 segundos. */
export function Seguimiento({ pedidoId, enLinea, alVolver }: Props) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagando, setPagando] = useState(false);
  const [verQr, setVerQr] = useState(false);

  const moviendose = pedido ? enCurso(pedido) : true;
  useEffect(() => {
    if (!enLinea) return;
    let vigente = true;
    const traer = () =>
      graphql<{ pedido: Pedido | null }>(UN_PEDIDO, { id: pedidoId })
        .then((d) => vigente && setPedido(d.pedido))
        .catch((e: Error) => vigente && setError(e.message));
    void traer();
    const reloj = moviendose ? window.setInterval(() => void traer(), 2000) : undefined;
    return () => {
      vigente = false;
      window.clearInterval(reloj);
    };
  }, [pedidoId, enLinea, moviendose]);

  async function pagar() {
    setPagando(true);
    try {
      await graphql(PAGAR_QR_DE_PRUEBA, { id: pedidoId });
      setVerQr(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPagando(false);
    }
  }

  if (!pedido) {
    return (
      <div className="pantalla">
        <Cabecera alVolver={alVolver} titulo="Pedido" />
        {error ? <p className="falla">{error}</p> : <p className="vacio">{enLinea ? 'Cargando el pedido…' : 'Necesitas conexión para ver el seguimiento.'}</p>}
      </div>
    );
  }

  if (verQr && pedido.cobro && porPagar(pedido)) {
    return <PagoQr pedido={pedido} pagando={pagando} alPagar={() => void pagar()} alVolver={() => setVerQr(false)} />;
  }

  const estado = estadoVisible(pedido);
  const deshecho = compensaciones(pedido);
  const mayorista = pedido.mayorista.nombre ?? pedido.mayorista.id;

  return (
    <div className="pantalla">
      <Cabecera alVolver={alVolver} titulo={`Pedido #${pedido.codigo}`}>
        <span className={`ins ${estado.clase}`}>{estado.texto}</span>
      </Cabecera>

      <div className="tarj fila tarjeta-pedido">
        <Iniciales nombre={mayorista} />
        <span className="crece">
          <strong>{mayorista}</strong>
          <span className="gris">
            {pedido.metodoPago === 'QR' ? 'Pago por QR' : 'Crédito'} · {fechaHora(pedido.creadoEn)}
          </span>
        </span>
        <span className="derecha">
          <strong className="num">{pedido.total.centavos ? pedido.total.texto : '—'}</strong>
          <span className="gris">{productos(pedido.lineas.length)}</span>
        </span>
      </div>

      {error && <p className="falla">{error}</p>}

      {porPagar(pedido) && (
        <button type="button" className="btn" onClick={() => setVerQr(true)}>
          Pagar con QR · {pedido.total.texto}
        </button>
      )}

      <section className="tarj seccion-tarj">
        <h2 className="tit t3">Estado del pedido</h2>
        <ol className="linea-tiempo">
          {lineaDeTiempo(pedido).map((paso) => (
            <li key={paso.nombre} className={`paso-saga ${paso.nodo}`}>
              <span className={`nodo nodo-${paso.nodo}`} aria-hidden="true">
                {paso.nodo === 'hecho' && <Icono nombre="verificado" tamano={14} />}
                {paso.nodo === 'rojo' && <Icono nombre="borrar" tamano={14} />}
              </span>
              <span className="crece">
                <strong>{paso.nombre}</strong>
                {paso.detalle && <span className="gris">{paso.detalle}</span>}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {deshecho.length > 0 && (
        <section className="deshecho">
          <strong className="tit t3">Lo deshicimos por ti</strong>
          <span className="texto-2">Como el pedido no siguió, revertimos lo que se había hecho.</span>
          <div className="tarj seccion-tarj">
            {deshecho.map((d) => (
              <div key={d} className="entre">
                <span>{d}</span>
                <span className="ins ins-verde">Hecho</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="tarj seccion-tarj">
        <h2 className="tit t3">Productos</h2>
        {pedido.lineas.map((l, i) => (
          <div key={`${l.producto.id}-${i}`} className="fila">
            <span className={`foto foto-42 ${tinte(l.producto.rubro ?? '')}`} aria-hidden="true" />
            <span className="crece">
              <strong>{l.producto.nombre ?? l.producto.id}</strong>
              <span className="gris">
                {l.cantidad} {nombreDe(l.presentacion as Presentacion, l.cantidad)} · {l.unidades} u.
              </span>
            </span>
            <strong className="num">{pedido.total.centavos ? l.subtotal.texto : '—'}</strong>
          </div>
        ))}
      </section>
    </div>
  );
}

function Cabecera({ alVolver, titulo, children }: { alVolver: () => void; titulo: string; children?: React.ReactNode }) {
  return (
    <div className="fila-chica">
      <button type="button" className="ico-plano" aria-label="Volver" onClick={alVolver}>
        <Icono nombre="volver" />
      </button>
      <h1 className="tit t2 crece">{titulo}</h1>
      {children}
    </div>
  );
}

/** El QR del pedido. En la demo no se cobra nada: «Simular pago» hace lo que haría el banco. */
function PagoQr({ pedido, pagando, alPagar, alVolver }: { pedido: Pedido; pagando: boolean; alPagar: () => void; alVolver: () => void }) {
  const cobro = pedido.cobro!;
  const [imagen, setImagen] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    void QRCode.toDataURL(cobro.codigo, { margin: 1, width: 240 }).then(setImagen);
  }, [cobro.codigo]);
  useEffect(() => {
    const reloj = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(reloj);
  }, []);

  return (
    <div className="pantalla pago-qr">
      <Cabecera alVolver={alVolver} titulo="Pagar con QR" />
      <span className="gris">Pagas a</span>
      <strong>{pedido.mayorista.nombre ?? pedido.mayorista.id}</strong>
      <span className="gris">Total a pagar</span>
      <span className="tit num monto-qr">{cobro.monto.texto}</span>
      <div className="marco-qr">{imagen ? <img src={imagen} alt="Código QR del pedido" width={240} height={240} /> : <span className="gris">Generando el QR…</span>}</div>
      <span className="gris centrado">Escanea con la app de tu banco o tu billetera móvil. Es un QR de demostración: no se cobra nada.</span>
      <span className="ins ins-ambar">Esperando pago · vence en {tiempoRestante(cobro.venceEn, ahora)}</span>
      <button type="button" className="btn" disabled={pagando} onClick={alPagar}>
        {pagando ? 'Verificando el pago…' : 'Simular pago (demo)'}
      </button>
    </div>
  );
}
