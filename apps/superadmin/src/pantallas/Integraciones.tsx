import { useCallback, useEffect, useMemo, useState } from 'react';
import { conProblemas, tasaDeEntrega, textoDeEntrega, type EntregaDeAviso, type Integraciones as Datos } from '../integraciones';
import { cuando } from '../mayoristas';
import { conToken, enviarConToken, URLS } from '../servicios';

/** CU-10: qué tiendas conectaron su e-commerce y qué avisos no les llegaron, con reenvío. */
export function Integraciones() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reenviando, setReenviando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await conToken<Datos>(`${URLS.conecta}/v1/admin/integraciones`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const problemas = useMemo(() => conProblemas(datos?.entregas ?? []), [datos]);

  async function reenviar(e: EntregaDeAviso) {
    setReenviando(e.id);
    setError(null);
    try {
      await enviarConToken(`${URLS.conecta}/v1/admin/entregas/${encodeURIComponent(e.id)}/reenviar`);
      await cargar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReenviando(null);
    }
  }

  return (
    <>
      <div className="cabecera">
        <h1 className="titulo-pantalla">Integraciones</h1>
      </div>
      <p className="gris intro">Las tiendas que conectaron su tienda en línea. Las llaves y los avisos los manejan ellas desde la app; aquí se ve qué está pasando.</p>

      {error && <p className="falla">{error}</p>}
      {!datos && !error && <p className="vacio">Cargando…</p>}

      {datos && (
        <>
          <div className="kpis">
            <div className="carta kpi">
              <span>Llaves activas</span>
              <strong>{datos.llaves.length}</strong>
              <small>{new Set(datos.llaves.map((l) => l.orgId)).size} tiendas</small>
            </div>
            <div className="carta kpi">
              <span>Direcciones de aviso</span>
              <strong>{datos.webhooks.length}</strong>
            </div>
            <div className="carta kpi">
              <span>Avisos que llegan</span>
              <strong>{tasaDeEntrega(datos.entregas) ?? '—'}</strong>
              <small>De los últimos {datos.entregas.length}</small>
            </div>
            <div className="carta kpi">
              <span>Con problemas</span>
              <strong>{problemas.length}</strong>
            </div>
          </div>

          <div className="carta tabla-ancha">
            <h2 className="titulo-carta">Avisos que no llegaron</h2>
            {!problemas.length ? (
              <p className="vacio">Todos los avisos llegaron.</p>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Tienda</th>
                    <th>Evento</th>
                    <th>Dirección</th>
                    <th>Qué pasó</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {problemas.map((e) => {
                    const estado = textoDeEntrega(e);
                    return (
                      <tr key={e.id}>
                        <td className="mono">{e.orgId}</td>
                        <td className="mono">{e.tipo}</td>
                        <td className="celda-url">{e.url}</td>
                        <td>
                          {e.ultimoError ?? '—'}
                          <br />
                          <small className="gris">
                            {e.intentos} {e.intentos === 1 ? 'intento' : 'intentos'} · {cuando(e.creadaEn)}
                          </small>
                        </td>
                        <td>
                          <span className={`insignia ${estado.clase}`}>{estado.texto}</span>
                        </td>
                        <td className="celda-accion">
                          <button className="boton-secundario" disabled={reenviando === e.id} onClick={() => void reenviar(e)}>
                            Reenviar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="carta tabla-ancha">
            <h2 className="titulo-carta">Llaves de API</h2>
            {!datos.llaves.length ? (
              <p className="vacio">Ninguna tienda sacó una llave todavía.</p>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Tienda</th>
                    <th>Nombre</th>
                    <th>Termina en</th>
                    <th>Creada</th>
                    <th>Último uso</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.llaves.map((l) => (
                    <tr key={l.id}>
                      <td className="mono">{l.orgId}</td>
                      <td>{l.nombre}</td>
                      <td className="mono">{l.termina}</td>
                      <td>{cuando(l.creadaEn)}</td>
                      <td>{l.ultimoUsoEn ? cuando(l.ultimoUsoEn) : 'Todavía no se usó'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="carta tabla-ancha">
            <h2 className="titulo-carta">Direcciones de aviso</h2>
            {!datos.webhooks.length ? (
              <p className="vacio">Ninguna tienda registró una dirección todavía.</p>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Tienda</th>
                    <th>Dirección</th>
                    <th>Desde</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.webhooks.map((w) => (
                    <tr key={w.id}>
                      <td className="mono">{w.orgId}</td>
                      <td className="celda-url">{w.url}</td>
                      <td>{cuando(w.creadoEn)}</td>
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
