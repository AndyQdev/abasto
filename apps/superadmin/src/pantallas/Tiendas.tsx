import { useEffect, useMemo, useState } from 'react';
import { cuando } from '../mayoristas';
import { graphql } from '../servicios';
import { celular, COMPRAS, FILTROS, filtrarTiendas, REACTIVAR, SUSPENDER, TIENDAS, textoDeNegocio, type FiltroDeTiendas, type TiendaDeAbasto } from '../tiendas';

type Compras = Record<string, { pedidos: number; ventas: string }>;

/** Quién compra en Abasto. Suspender deja a la tienda sin entrar y sin hacer pedidos nuevos, hasta que se reactive. */
export function Tiendas() {
  const [tiendas, setTiendas] = useState<TiendaDeAbasto[] | null>(null);
  const [compras, setCompras] = useState<Compras>({});
  const [filtro, setFiltro] = useState<FiltroDeTiendas>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [suspendiendo, setSuspendiendo] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vigente = true;
    graphql<{ tiendas: TiendaDeAbasto[] }>(TIENDAS)
      .then((d) => vigente && setTiendas(d.tiendas))
      .catch((e: Error) => vigente && setError(e.message));
    // Lo que compró es un extra: si Pedidos no responde, la lista se ve igual
    graphql<{ traccion: { tiendas: { tienda: { id: string }; pedidos: number; ventas: { texto: string } }[] } }>(COMPRAS)
      .then((d) => {
        if (vigente) setCompras(Object.fromEntries(d.traccion.tiendas.map((t) => [t.tienda.id, { pedidos: t.pedidos, ventas: t.ventas.texto }])));
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  const visibles = useMemo(() => filtrarTiendas(tiendas ?? [], filtro, busqueda), [tiendas, filtro, busqueda]);
  const suspendidas = tiendas?.filter((t) => t.suspendida).length ?? 0;

  async function cambiar(hacer: Promise<TiendaDeAbasto>, texto: string) {
    setOcupado(true);
    setError(null);
    try {
      const nueva = await hacer;
      setTiendas((lista) => lista?.map((t) => (t.id === nueva.id ? nueva : t)) ?? null);
      setSuspendiendo(null);
      setMotivo('');
      setAviso(texto);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  const suspender = (t: TiendaDeAbasto) =>
    cambiar(
      graphql<{ suspenderTienda: TiendaDeAbasto }>(SUSPENDER, { id: t.id, motivo }).then((d) => d.suspenderTienda),
      `${t.nombre} quedó suspendida. Ya no puede entrar ni hacer pedidos nuevos.`,
    );
  const reactivar = (t: TiendaDeAbasto) =>
    cambiar(graphql<{ reactivarTienda: TiendaDeAbasto }>(REACTIVAR, { id: t.id }).then((d) => d.reactivarTienda), `${t.nombre} ya puede volver a comprar.`);

  return (
    <>
      <div className="cabecera">
        <h1 className="titulo-pantalla">Tiendas</h1>
        <input className="entrada buscador" type="search" placeholder="Buscar por nombre, ciudad o celular" aria-label="Buscar tienda" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>
      <div className="pestanas" role="tablist">
        {FILTROS.map((f) => (
          <button key={f.valor} role="tab" aria-selected={filtro === f.valor} className={`chip ${filtro === f.valor ? 'activa' : ''}`} onClick={() => setFiltro(f.valor)}>
            {f.texto}
            {f.valor === 'suspendidas' && !!suspendidas && <span className="contador">{suspendidas}</span>}
          </button>
        ))}
      </div>

      {error && <p className="falla">{error}</p>}
      {!tiendas && !error && <p className="vacio">Cargando…</p>}
      {tiendas && !visibles.length && <div className="carta vacio">{busqueda ? 'Ninguna tienda coincide con esa búsqueda.' : 'Todavía no hay ninguna.'}</div>}

      {!!visibles.length && (
        <div className="carta tabla-ancha">
          <table className="tabla">
            <thead>
              <tr>
                <th>Tienda</th>
                <th>Qué es</th>
                <th>Celular</th>
                <th>Se registró</th>
                <th className="num">Pedidos</th>
                <th className="num">Compró</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.nombre}</strong>
                    {t.dePrueba && <small className="gris"> · de prueba</small>}
                    <br />
                    <small className="gris">{t.ciudad || 'Sin ciudad'}</small>
                  </td>
                  <td>{textoDeNegocio(t.negocio)}</td>
                  <td className="mono">{celular(t.telefono)}</td>
                  <td>{cuando(t.registradaEn)}</td>
                  <td className="num">{compras[t.id]?.pedidos ?? 0}</td>
                  <td className="num">{compras[t.id]?.ventas ?? '—'}</td>
                  <td>
                    <span className={`insignia ${t.suspendida ? 'error' : 'exito'}`}>{t.suspendida ? 'Suspendida' : 'Activa'}</span>
                    {t.motivoSuspension && (
                      <>
                        <br />
                        <small className="gris">{t.motivoSuspension}</small>
                      </>
                    )}
                  </td>
                  <td className="celda-accion">
                    {t.suspendida ? (
                      <button className="boton-secundario" disabled={ocupado} onClick={() => void reactivar(t)}>
                        Reactivar
                      </button>
                    ) : suspendiendo === t.id ? (
                      <div className="suspender">
                        <input className="entrada" autoFocus placeholder="¿Por qué se suspende?" aria-label={`Motivo para suspender a ${t.nombre}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                        <button className="boton-peligro" disabled={ocupado || motivo.trim().length < 3} onClick={() => void suspender(t)}>
                          Suspender
                        </button>
                        <button className="boton-secundario" disabled={ocupado} onClick={() => setSuspendiendo(null)}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button className="boton-secundario" onClick={() => setSuspendiendo(t.id)}>
                        Suspender
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aviso && (
        <div className="aviso" role="status">
          {aviso}
        </div>
      )}
    </>
  );
}
