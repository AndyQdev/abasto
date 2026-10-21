import { useEffect, useState } from 'react';
import type { OperacionLocal } from '@abasto/outbox-offline';
import { bandeja, graphql } from '../servicios';

interface Pedido {
  id: string;
  codigo: string;
  estado: string;
  total: { texto: string };
  creadoEn: string;
  motivoRechazo: string | null;
  mayorista: { id: string; nombre?: string | null };
}

const ESTADOS: Record<string, [string, string]> = {
  PENDIENTE: ['Procesando', 'neutro'],
  POR_CONFIRMAR: ['Esperando al mayorista', 'advertencia'],
  CONFIRMADO: ['Confirmado', 'exito'],
  EN_PREPARACION: ['En preparación', 'exito'],
  DESPACHADO: ['En camino', 'exito'],
  ENTREGADO: ['Entregado', 'exito'],
  RECHAZADO: ['Rechazado', 'error'],
  CANCELADO: ['Cancelado', 'neutro'],
};

export function Pedidos({ enLinea }: { enLinea: boolean }) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [bandejaLocal, setBandejaLocal] = useState<OperacionLocal[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void bandeja.pendientes().then(setBandejaLocal);
    return bandeja.alCambiar((ops) => setBandejaLocal(ops.filter((o) => o.estado !== 'aplicada')));
  }, []);

  useEffect(() => {
    if (!enLinea) return;
    graphql<{ misCompras: Pedido[] }>(
      `{ misCompras { id codigo estado creadoEn motivoRechazo total { texto } mayorista { id nombre } } }`,
    )
      .then((d) => {
        setPedidos(d.misCompras);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [enLinea, bandejaLocal.length]);

  return (
    <section className="pantalla">
      <h1 className="titulo-pantalla">Mis pedidos</h1>

      {bandejaLocal.length > 0 && (
        <div className="carta">
          <h2 className="titulo-seccion">En tu teléfono</h2>
          {bandejaLocal.map((o) => (
            <div key={o.clave} className="item">
              <div>
                Pedido a {String(o.datos.mayoristaId)}
                <span className="unitario mono">Clave única {o.clave.slice(0, 8)}</span>
              </div>
              <span className={`insignia ${o.estado === 'pendiente' ? 'advertencia' : 'error'}`}>
                {o.estado === 'pendiente' ? 'Se enviará cuando vuelva la señal' : (o.error ?? o.estado)}
              </span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="falla">{error}</p>}
      {!pedidos.length && !bandejaLocal.length && <p className="vacio">No hay pedidos todavía.</p>}

      {pedidos.map((p) => {
        const [texto, clase] = ESTADOS[p.estado] ?? [p.estado, 'neutro'];
        return (
          <div key={p.id} className="carta pedido">
            <div className="item">
              <div>
                <strong className="mono">#{p.codigo}</strong>
                <span className="unitario">{p.mayorista.nombre ?? p.mayorista.id}</span>
              </div>
              <strong>{p.total.texto}</strong>
            </div>
            <span className={`insignia ${clase}`}>{texto}</span>
            {p.motivoRechazo && <p className="gris">Lo deshicimos por ti: {p.motivoRechazo}</p>}
          </div>
        );
      })}
    </section>
  );
}
