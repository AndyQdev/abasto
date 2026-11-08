import { useCallback, useEffect, useRef, useState } from 'react';
import { cuando, whatsapp } from '../mayoristas';
import {
  CELULARES,
  centavosDe,
  faltaParaResolver,
  FORMAS,
  insigniaDeReclamo,
  PESTANAS,
  RECLAMOS,
  RESOLVER,
  textoDeDevolucion,
  textoDeEstadoDePedido,
  textoDeMotivo,
  textoDePago,
  type Decision,
  type EstadoDeReclamo,
  type ReclamoFila,
} from '../reclamos';
import { graphql } from '../servicios';

/** CU-16: la tienda reporta un problema, Abasto habla con ella, lo resuelve a mano y aquí lo anota. */
export function Reclamos() {
  const [estado, setEstado] = useState<EstadoDeReclamo>('ABIERTO');
  const [lista, setLista] = useState<ReclamoFila[] | null>(null);
  const [porResolver, setPorResolver] = useState<number | null>(null);
  const [celulares, setCelulares] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Si se cambia de pestaña antes de que responda la anterior, esa respuesta ya no se muestra
  const ultimaPedida = useRef(0);

  const cargar = useCallback(async () => {
    const esta = ++ultimaPedida.current;
    setError(null);
    try {
      const [d, abiertos] = await Promise.all([
        graphql<{ reclamos: ReclamoFila[] }>(RECLAMOS, { estado }),
        graphql<{ reclamos: { id: string }[] }>(`query { reclamos(estado: ABIERTO) { id } }`),
      ]);
      if (esta !== ultimaPedida.current) return;
      setLista(d.reclamos);
      setPorResolver(abiertos.reclamos.length);
    } catch (e) {
      if (esta === ultimaPedida.current) setError((e as Error).message);
    }
  }, [estado]);

  useEffect(() => {
    setLista(null);
    void cargar();
  }, [cargar]);

  // El celular es un extra para escribirle: si Catálogo no responde, el reclamo se ve igual
  useEffect(() => {
    graphql<{ tiendas: { id: string; telefono: string | null }[] }>(CELULARES)
      .then((d) => setCelulares(Object.fromEntries(d.tiendas.map((t) => [t.id, t.telefono]))))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  const resuelto = (r: ReclamoFila, texto: string) => {
    setAviso(texto);
    setLista((l) => l?.filter((x) => x.id !== r.id) ?? null);
    setPorResolver((n) => (n === null ? n : Math.max(0, n - 1)));
  };

  return (
    <>
      <div className="cabecera">
        <h1 className="titulo-pantalla">Reclamos</h1>
      </div>
      <p className="gris intro">Lo que las tiendas reportan desde la app. Aquí solo se anota cómo se resolvió: la devolución la haces tú, y no cambia el cobro, el crédito ni la cuenta del pedido.</p>

      <div className="pestanas" role="tablist">
        {PESTANAS.map((p) => (
          <button key={p.estado} role="tab" aria-selected={estado === p.estado} className={`chip ${estado === p.estado ? 'activa' : ''}`} onClick={() => setEstado(p.estado)}>
            {p.titulo}
            {p.estado === 'ABIERTO' && !!porResolver && <span className="contador">{porResolver}</span>}
          </button>
        ))}
      </div>

      {error && <p className="falla">{error}</p>}
      {!lista && !error && <p className="vacio">Cargando…</p>}
      {lista && !lista.length && <div className="carta vacio">{estado === 'ABIERTO' ? 'No hay reclamos por resolver. Cuando una tienda reporte un problema, aparece aquí.' : 'Todavía no hay ninguno.'}</div>}
      {lista?.map((r) => <TarjetaDeReclamo key={r.id} r={r} celular={celulares[r.pedido.tienda.id] ?? null} alResolver={resuelto} alFallar={setError} />)}

      {aviso && (
        <div className="aviso" role="status">
          {aviso}
        </div>
      )}
    </>
  );
}

function TarjetaDeReclamo({ r, celular, alResolver, alFallar }: { r: ReclamoFila; celular: string | null; alResolver: (r: ReclamoFila, aviso: string) => void; alFallar: (e: string) => void }) {
  const [decision, setDecision] = useState<Decision>({ monto: '', forma: '', respuesta: '' });
  const [ocupado, setOcupado] = useState(false);
  const est = insigniaDeReclamo(r.estado);
  const tienda = r.pedido.tienda.nombre ?? r.pedido.tienda.id;
  const wa = whatsapp(celular);
  const cambiar = (parcial: Partial<Decision>) => setDecision((d) => ({ ...d, ...parcial }));
  const faltaAprobar = faltaParaResolver(true, decision, r.pedido.total.centavos);
  const faltaRechazar = faltaParaResolver(false, decision, r.pedido.total.centavos);

  async function resolver(aprobado: boolean) {
    setOcupado(true);
    try {
      const centavos = aprobado ? (centavosDe(decision.monto) ?? 0) : 0;
      await graphql(RESOLVER, {
        entrada: { reclamoId: r.id, aprobado, devueltoCentavos: centavos, forma: aprobado && centavos > 0 ? decision.forma : null, respuesta: decision.respuesta.trim() },
      });
      alResolver(r, aprobado ? `Anotaste el reclamo de ${tienda}. Ya ve tu respuesta en la app.` : `Rechazaste el reclamo de ${tienda}. Ya ve tu respuesta en la app.`);
    } catch (e) {
      alFallar((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <article className="carta solicitud" aria-label={`Reclamo del pedido ${r.pedido.codigo}`}>
      <header>
        <div>
          <h2 className="titulo-carta">
            {textoDeMotivo(r.motivo)} · {r.pedido.codigo}
          </h2>
          <small className="gris">
            {tienda} · {cuando(r.creadoEn)}
          </small>
        </div>
        <span className={`insignia ${est.clase}`}>{est.texto}</span>
      </header>

      <dl className="datos">
        <div>
          <dt>Total del pedido</dt>
          <dd>{r.pedido.total.texto}</dd>
        </div>
        <div>
          <dt>Cómo pagó</dt>
          <dd>{textoDePago(r.pedido.metodoPago)}</dd>
        </div>
        <div>
          <dt>Pedido</dt>
          <dd>{textoDeEstadoDePedido(r.pedido.estado)}</dd>
        </div>
        <div>
          <dt>Vendedor</dt>
          <dd>{r.pedido.mayorista.nombre ?? r.pedido.mayorista.id}</dd>
        </div>
      </dl>

      {r.detalle && <p className="motivo-reclamo">«{r.detalle}»</p>}
      {wa && (
        <p>
          <a href={wa} target="_blank" rel="noopener">
            Escribirle por WhatsApp
          </a>
        </p>
      )}

      {r.estado === 'ABIERTO' ? (
        <div className="rechazo">
          <div className="resolver-monto">
            <label>
              ¿Cuánto le devolviste, en Bs? (vacío si no le devolviste dinero)
              <input className="entrada" inputMode="decimal" aria-label={`Monto devuelto de ${r.pedido.codigo}`} placeholder="0,00" value={decision.monto} onChange={(e) => cambiar({ monto: e.target.value })} />
            </label>
            <button type="button" className="boton-secundario" onClick={() => cambiar({ monto: (r.pedido.total.centavos / 100).toFixed(2).replace('.', ',') })}>
              Todo
            </button>
            <label>
              ¿Cómo?
              <select className="entrada" aria-label={`Forma de devolución de ${r.pedido.codigo}`} value={decision.forma} onChange={(e) => cambiar({ forma: e.target.value as Decision['forma'] })}>
                <option value="">Elige</option>
                {FORMAS.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.texto}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label htmlFor={`respuesta-${r.id}`}>Tu respuesta. La tienda la lee en la app.</label>
          <textarea id={`respuesta-${r.id}`} className="entrada" rows={2} maxLength={500} value={decision.respuesta} onChange={(e) => cambiar({ respuesta: e.target.value })} />
          {decision.respuesta.trim().length >= 3 && faltaAprobar && <small className="gris">{faltaAprobar}</small>}
          <div className="acciones">
            <button className="boton-peligro" disabled={ocupado || !!faltaRechazar} onClick={() => void resolver(false)}>
              Rechazar
            </button>
            <button className="boton-primario" disabled={ocupado || !!faltaAprobar} onClick={() => void resolver(true)}>
              Aprobar y anotar
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="motivo-resuelto">{r.estado === 'APROBADO' ? textoDeDevolucion(r) : 'No se devolvió dinero'}</p>
          {r.respuesta && <p className="gris">Respondiste: {r.respuesta}</p>}
        </>
      )}
    </article>
  );
}
