import { useEffect, useState } from 'react';
import type { OperacionLocal } from '@abasto/outbox-offline';
import { nombreCorto } from '../catalogo';
import { estadoVisible, fechaHora, filtrarPedidos, MIS_COMPRAS, porPagar, productos, type Filtro, type Pedido } from '../pedidos';
import { bandeja, graphql, guardado } from '../servicios';

interface Props {
  enLinea: boolean;
  alAbrir: (id: string) => void;
}

const PESTANAS: [Filtro, string][] = [
  ['todos', 'Todos'],
  ['en_curso', 'En curso'],
  ['entregados', 'Entregados'],
  ['cancelados', 'Cancelados'],
];

/** Mis pedidos: los que ya llegaron a Abasto y los que esperan señal en el teléfono. */
export function Pedidos({ enLinea, alAbrir }: Props) {
  const [pedidos, setPedidos] = useState<Pedido[]>(() => guardado.leer<Pedido[]>('pedidos') ?? []);
  const [bandejaLocal, setBandejaLocal] = useState<OperacionLocal[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void bandeja.pendientes().then(setBandejaLocal);
    return bandeja.alCambiar((ops) => setBandejaLocal(ops.filter((o) => o.estado !== 'aplicada')));
  }, []);

  // Se vuelve a pedir cuando la bandeja manda algo y cada 5 s mientras haya un pedido en curso
  const hayEnCurso = pedidos.some((p) => p.estado === 'PENDIENTE' || p.estado === 'POR_CONFIRMAR');
  useEffect(() => {
    if (!enLinea) return;
    let vigente = true;
    const traer = () =>
      graphql<{ misCompras: Pedido[] }>(MIS_COMPRAS)
        .then((d) => {
          if (!vigente) return;
          setPedidos(d.misCompras);
          guardado.escribir('pedidos', d.misCompras);
          setError(null);
        })
        .catch((e: Error) => vigente && setError(e.message));
    void traer();
    const reloj = hayEnCurso ? window.setInterval(() => void traer(), 5000) : undefined;
    return () => {
      vigente = false;
      window.clearInterval(reloj);
    };
  }, [enLinea, bandejaLocal.length, hayEnCurso]);

  const lista = filtrarPedidos(pedidos, filtro);

  return (
    <div className="pantalla">
      <h1 className="tit t1">Mis pedidos</h1>

      {bandejaLocal.length > 0 && (
        <section className="tarj seccion-tarj">
          <h2 className="tit t3">En tu teléfono</h2>
          {bandejaLocal.map((o) => (
            <div key={o.clave} className="entre">
              <span className="crece">
                <span>Pedido a {String(o.datos.mayoristaId)}</span>
                <span className="gris mono">Clave única {o.clave.slice(0, 8)}</span>
              </span>
              <span className={`ins ${o.estado === 'pendiente' ? 'ins-ambar' : 'ins-rojo'}`}>
                {o.estado === 'pendiente' ? 'Se enviará cuando vuelva la señal' : (o.error ?? o.estado)}
              </span>
            </div>
          ))}
        </section>
      )}

      <div role="group" aria-label="Estado" className="scroll-x">
        {PESTANAS.map(([id, texto]) => (
          <button key={id} type="button" className="chip" aria-pressed={filtro === id} onClick={() => setFiltro(id)}>
            {texto}
          </button>
        ))}
      </div>

      {error && <p className="falla">{error}</p>}
      {!lista.length && <div className="tarj vacio-tarj gris">No hay pedidos en esta pestaña.</div>}

      <div className="lista">
        {lista.map((p) => {
          const estado = estadoVisible(p);
          return (
            <button key={p.id} type="button" className="tarj pedido-fila" onClick={() => alAbrir(p.id)}>
              <span className="entre">
                <strong className="mono">#{p.codigo}</strong>
                <span className={`ins ${estado.clase}`}>{estado.texto}</span>
              </span>
              <strong>{nombreCorto(p.mayorista.nombre ?? p.mayorista.id)}</strong>
              <span className="gris">
                {productos(p.lineas.length)} · <span className="num">{p.total.texto}</span> · {fechaHora(p.creadoEn)}
              </span>
              {porPagar(p) && <span className="ins ins-ambar">Paga con QR para que el mayorista lo reciba</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
