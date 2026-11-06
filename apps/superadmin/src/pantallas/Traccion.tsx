import { useEffect, useState } from 'react';
import { graphql } from '../servicios';
import { crecimiento, recompra, TRACCION, type Traccion as T } from '../traccion';
import { BarrasPorSemana } from './Barras';

type Alcance = 'abasto' | 'todos';

/**
 * Tracción de la plataforma. Mientras no hay afiliados, Abasto vende por su cuenta:
 * estos números son el argumento para que los mayoristas se sumen.
 */
export function Traccion() {
  const [alcance, setAlcance] = useState<Alcance>('abasto');
  const [semanas, setSemanas] = useState(8);
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    graphql<{ traccion: T }>(TRACCION, { mayoristaId: alcance === 'abasto' ? 'abasto' : null, semanas })
      .then((d) => {
        if (!vigente) return;
        setDatos(d.traccion);
        setError(null);
      })
      .catch((e: Error) => vigente && setError(e.message));
    return () => {
      vigente = false;
    };
  }, [alcance, semanas]);

  const cambio = datos ? crecimiento(datos.semanas) : null;

  return (
    <>
      <div className="cabecera">
        <h1 className="titulo-pantalla">Tracción</h1>
        <div className="filtros-traccion">
          <select className="entrada" value={alcance} onChange={(e) => setAlcance(e.target.value as Alcance)} aria-label="Qué ventas">
            <option value="abasto">Lo que vende Abasto</option>
            <option value="todos">Toda la plataforma</option>
          </select>
          <select className="entrada" value={semanas} onChange={(e) => setSemanas(Number(e.target.value))} aria-label="Período">
            <option value={4}>Últimas 4 semanas</option>
            <option value={8}>Últimas 8 semanas</option>
            <option value={12}>Últimas 12 semanas</option>
          </select>
        </div>
      </div>

      {error && <p className="falla">{error}</p>}
      {!datos && !error && <p className="vacio">Calculando…</p>}

      {datos && (
        <>
          <div className="kpis">
            <div className="carta kpi">
              <span>Ventas</span>
              <strong>{datos.ventas.texto}</strong>
              {cambio && <small>{cambio} la última semana</small>}
            </div>
            <div className="carta kpi">
              <span>Pedidos</span>
              <strong>{datos.pedidos}</strong>
              <small>Ticket promedio {datos.ticketPromedio.texto}</small>
            </div>
            <div className="carta kpi">
              <span>Tiendas activas</span>
              <strong>{datos.tiendasActivas}</strong>
              <small>Compraron en los últimos 30 días</small>
            </div>
            <div className="carta kpi">
              <span>Vuelven a comprar</span>
              <strong>{recompra(datos)}</strong>
              <small>
                {datos.tiendasQueRepiten} de {datos.tiendas.length} {datos.tiendas.length === 1 ? 'tienda' : 'tiendas'}
              </small>
            </div>
          </div>

          <div className="carta">
            <h2 className="titulo-carta">Ventas por semana</h2>
            <BarrasPorSemana
              titulo="Ventas por semana"
              barras={datos.semanas.map((s) => ({
                desde: s.desde,
                valor: s.ventas.centavos,
                etiqueta: s.ventas.texto,
                detalle: `${s.pedidos} ${s.pedidos === 1 ? 'pedido' : 'pedidos'} · ${s.ventas.texto}`,
              }))}
            />
          </div>

          <div className="carta">
            <h2 className="titulo-carta">Tiendas que compran</h2>
            {!datos.tiendas.length ? (
              <p className="vacio">Todavía no hay ventas confirmadas en este período.</p>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Tienda</th>
                    <th className="num">Pedidos</th>
                    <th className="num">Compró</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.tiendas.map((t) => (
                    <tr key={t.tienda.id}>
                      <td>{t.tienda.nombre ?? t.tienda.id}</td>
                      <td className="num">{t.pedidos}</td>
                      <td className="num">{t.ventas.texto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}
