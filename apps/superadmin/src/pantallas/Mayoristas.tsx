import { useCallback, useEffect, useRef, useState } from 'react';
import { cuando, insignia, MOTIVOS, motivoValido, PESTANAS, POR_VERIFICAR, RECHAZAR, VERIFICAR, whatsapp, type EstadoVerificacion, type Solicitud } from '../mayoristas';
import { graphql } from '../servicios';

/**
 * CU-01 · Mayoristas: los que se registraron en el Panel esperan aquí. Abasto revisa el NIT y al
 * representante, y verifica (sus productos salen en la app) o rechaza con un motivo que él ve en su Panel.
 */
export function Mayoristas() {
  const [estado, setEstado] = useState<EstadoVerificacion>('PENDIENTE');
  const [lista, setLista] = useState<Solicitud[] | null>(null);
  const [pendientes, setPendientes] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Si se cambia de pestaña antes de que responda la anterior, esa respuesta ya no se muestra
  const ultimaPedida = useRef(0);
  const cargar = useCallback(async () => {
    const esta = ++ultimaPedida.current;
    setError(null);
    try {
      const [d, p] = await Promise.all([
        graphql<{ mayoristasPorVerificar: Solicitud[] }>(POR_VERIFICAR, { estado }),
        graphql<{ mayoristasPorVerificar: Solicitud[] }>(POR_VERIFICAR, { estado: 'PENDIENTE' }),
      ]);
      if (esta !== ultimaPedida.current) return;
      setLista(d.mayoristasPorVerificar);
      setPendientes(p.mayoristasPorVerificar.length);
    } catch (e) {
      if (esta === ultimaPedida.current) setError((e as Error).message);
    }
  }, [estado]);

  useEffect(() => {
    setLista(null);
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  const decidido = (s: Solicitud, texto: string) => {
    setAviso(texto);
    setLista((l) => l?.filter((x) => x.id !== s.id) ?? null);
    if (s.estadoVerificacion === 'PENDIENTE') setPendientes((n) => (n === null ? n : Math.max(0, n - 1)));
  };

  return (
    <>
      <div className="cabecera">
        <h1 className="titulo-pantalla">Mayoristas</h1>
      </div>
      <p className="gris intro">
        Se registran solos desde el Panel. Revisa el NIT y habla con el representante antes de verificar: desde ahí sus productos salen en la app.
      </p>

      <div className="pestanas" role="tablist">
        {PESTANAS.map((p) => (
          <button key={p.estado} role="tab" aria-selected={estado === p.estado} className={`chip ${estado === p.estado ? 'activa' : ''}`} onClick={() => setEstado(p.estado)}>
            {p.titulo}
            {p.estado === 'PENDIENTE' && !!pendientes && <span className="contador">{pendientes}</span>}
          </button>
        ))}
      </div>

      {error && <p className="falla">{error}</p>}
      {!lista && !error && <p className="vacio">Cargando…</p>}
      {lista && !lista.length && (
        <div className="carta vacio">
          {estado === 'PENDIENTE' ? 'No hay mayoristas esperando. Cuando uno se registre en el Panel, aparece aquí.' : 'Todavía no hay ninguno.'}
        </div>
      )}
      {lista?.map((s) => <TarjetaDeSolicitud key={s.id} s={s} alDecidir={decidido} alFallar={setError} />)}

      {aviso && (
        <div className="aviso" role="status">
          {aviso}
        </div>
      )}
    </>
  );
}

function TarjetaDeSolicitud({ s, alDecidir, alFallar }: { s: Solicitud; alDecidir: (s: Solicitud, aviso: string) => void; alFallar: (e: string) => void }) {
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const est = insignia(s.estadoVerificacion);
  const wa = whatsapp(s.telefono);

  async function verificar() {
    setOcupado(true);
    try {
      await graphql(VERIFICAR, { id: s.id });
      alDecidir(s, `${s.nombre} quedó verificado: sus productos ya salen en la app.`);
    } catch (e) {
      alFallar((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function rechazar() {
    const m = motivoValido(motivo);
    if (!m) return;
    setOcupado(true);
    try {
      await graphql(RECHAZAR, { id: s.id, motivo: m });
      alDecidir(s, `${s.nombre} quedó rechazado. Verá el motivo en su Panel.`);
    } catch (e) {
      alFallar((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <article className="carta solicitud">
      <header>
        <div>
          <h2 className="titulo-carta">{s.nombre}</h2>
          <small className="gris">
            {s.ciudad} · {cuando(s.registradaEn)}
          </small>
        </div>
        <span className={`insignia ${est.clase}`}>{est.texto}</span>
      </header>

      <dl className="datos">
        <div>
          <dt>NIT</dt>
          <dd className="mono">{s.nit ?? 'Sin NIT'}</dd>
        </div>
        <div>
          <dt>Representante</dt>
          <dd>{s.representante ?? '—'}</dd>
        </div>
        <div>
          <dt>Teléfono</dt>
          <dd>
            {s.telefono ?? '—'}
            {wa && (
              <>
                {' · '}
                <a href={wa} target="_blank" rel="noopener">
                  WhatsApp
                </a>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>Correo</dt>
          <dd>{s.correo ? <a href={`mailto:${s.correo}`}>{s.correo}</a> : '—'}</dd>
        </div>
      </dl>

      {s.estadoVerificacion === 'RECHAZADO' && s.motivoRechazo && <p className="motivo">Motivo: {s.motivoRechazo}</p>}

      {s.estadoVerificacion !== 'VERIFICADO' && !rechazando && (
        <div className="acciones">
          {s.estadoVerificacion === 'PENDIENTE' && (
            <button className="boton-secundario" disabled={ocupado} onClick={() => setRechazando(true)}>
              Rechazar
            </button>
          )}
          <button className="boton-primario" disabled={ocupado} onClick={() => void verificar()}>
            {s.estadoVerificacion === 'RECHAZADO' ? 'Verificar igual' : 'Verificar'}
          </button>
        </div>
      )}

      {rechazando && (
        <div className="rechazo">
          <label htmlFor={`motivo-${s.id}`}>¿Por qué lo rechazas? El mayorista lo verá en su Panel.</label>
          <div className="motivos">
            {MOTIVOS.map((m) => (
              <button key={m} className="chip" aria-pressed={motivo === m} onClick={() => setMotivo(m)}>
                {m}
              </button>
            ))}
          </div>
          <textarea id={`motivo-${s.id}`} className="entrada" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="O escribe el motivo" />
          <div className="acciones">
            <button className="boton-secundario" disabled={ocupado} onClick={() => setRechazando(false)}>
              Cancelar
            </button>
            <button className="boton-peligro" disabled={ocupado || !motivoValido(motivo)} onClick={() => void rechazar()}>
              Rechazar con este motivo
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
