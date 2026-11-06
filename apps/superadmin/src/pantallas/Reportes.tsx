import { useEffect, useMemo, useState } from 'react';
import { escala, porCiudad, REPORTE, reporteEnCsv, textoDeBs, type Reporte, type SemanaDeReporte } from '../reportes';
import { graphql } from '../servicios';
import { semana } from '../traccion';
import { BarrasPorSemana } from './Barras';

type Alcance = 'todos' | 'abasto';

/** La barra no es la única fuente: la tabla de abajo tiene los mismos números. */
function Grafico({ titulo, semanas, valor, detalle }: { titulo: string; semanas: SemanaDeReporte[]; valor: (s: SemanaDeReporte) => number; detalle: (s: SemanaDeReporte) => string }) {
  return (
    <div className="carta">
      <h2 className="titulo-carta">{titulo}</h2>
      <BarrasPorSemana titulo={titulo} barras={semanas.map((s) => ({ desde: s.desde, valor: valor(s), etiqueta: String(valor(s)), detalle: detalle(s) }))} />
    </div>
  );
}

function descargar(nombre: string, contenido: string) {
  // El BOM hace que Excel lea bien las tildes
  const url = URL.createObjectURL(new Blob([`﻿${contenido}`], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

/** Cómo va la plataforma: pedidos por semana, tiendas que compran y ventas por ciudad. */
export function Reportes() {
  const [alcance, setAlcance] = useState<Alcance>('todos');
  const [semanas, setSemanas] = useState(12);
  const [datos, setDatos] = useState<Reporte | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    graphql<{ traccion: Reporte }>(REPORTE, { mayoristaId: alcance === 'abasto' ? 'abasto' : null, semanas })
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

  const ciudades = useMemo(() => porCiudad(datos?.tiendas ?? []), [datos]);
  const anchos = useMemo(() => escala(ciudades.map((c) => c.centavos)), [ciudades]);

  return (
    <>
      <div className="cabecera">
        <h1 className="titulo-pantalla">Reportes</h1>
        <div className="filtros-traccion">
          <select className="entrada" value={alcance} onChange={(e) => setAlcance(e.target.value as Alcance)} aria-label="Qué ventas">
            <option value="todos">Toda la plataforma</option>
            <option value="abasto">Lo que vende Abasto</option>
          </select>
          <select className="entrada" value={semanas} onChange={(e) => setSemanas(Number(e.target.value))} aria-label="Período">
            <option value={4}>Últimas 4 semanas</option>
            <option value={12}>Últimas 12 semanas</option>
            <option value={26}>Últimas 26 semanas</option>
          </select>
          <button className="boton-secundario" disabled={!datos} onClick={() => datos && descargar(`abasto-reporte-${semanas}-semanas.csv`, reporteEnCsv(datos))}>
            Descargar para Excel
          </button>
        </div>
      </div>

      {error && <p className="falla">{error}</p>}
      {!datos && !error && <p className="vacio">Calculando…</p>}

      {datos && (
        <>
          <Grafico titulo="Pedidos por semana" semanas={datos.semanas} valor={(s) => s.pedidos} detalle={(s) => `${s.pedidos} ${s.pedidos === 1 ? 'pedido' : 'pedidos'}, ${s.ventas.texto}`} />
          <Grafico titulo="Tiendas que compraron" semanas={datos.semanas} valor={(s) => s.tiendas} detalle={(s) => `${s.tiendas} ${s.tiendas === 1 ? 'tienda' : 'tiendas'}`} />

          <div className="carta">
            <h2 className="titulo-carta">Ventas por ciudad</h2>
            {!ciudades.length ? (
              <p className="vacio">Todavía no hay ventas en este período.</p>
            ) : (
              <div className="ciudades">
                {ciudades.map((c, i) => (
                  <div key={c.ciudad} className="ciudad" title={`${c.tiendas} tiendas · ${c.pedidos} pedidos`}>
                    <span className="ciudad-nombre">{c.ciudad}</span>
                    <span className="ciudad-pista">
                      <span className="ciudad-barra" style={{ width: `${anchos[i]}%` }} />
                    </span>
                    <span className="ciudad-valor">{textoDeBs(c.centavos)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="carta tabla-ancha">
            <h2 className="titulo-carta">Semana por semana</h2>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Semana</th>
                  <th className="num">Pedidos</th>
                  <th className="num">Tiendas</th>
                  <th className="num">Ventas</th>
                </tr>
              </thead>
              <tbody>
                {[...datos.semanas].reverse().map((s) => (
                  <tr key={s.desde}>
                    <td>{semana(s.desde)}</td>
                    <td className="num">{s.pedidos}</td>
                    <td className="num">{s.tiendas}</td>
                    <td className="num">{s.ventas.texto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
