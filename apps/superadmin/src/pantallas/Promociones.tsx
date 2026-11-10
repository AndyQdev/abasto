import { useCallback, useEffect, useMemo, useState } from 'react';
import { cuando } from '../mayoristas';
import {
  BORRADOR_VACIO,
  cargarPromociones,
  cargarResumen,
  enviarPromocion,
  etiquetaDeCanal,
  faltaParaEnviar,
  LARGO_DEL_MENSAJE,
  LARGO_DEL_TITULO,
  PRODUCTOS_DE_ABASTO,
  textoDeEnvio,
  textoDeResultado,
  type Borrador,
  type Promocion,
  type ResumenDeNotificaciones,
} from '../promociones';
import { graphql } from '../servicios';

interface ProductoDeAbasto {
  id: string;
  nombre: string;
  foto: string | null;
}

/** Una clave por borrador: si el envío se repite (doble clic, red que se corta), la promoción sale una sola vez. */
const nuevaClave = () => crypto.randomUUID();

/** Superadmin › Promociones: le llega como notificación push a todos los que tienen la app. */
export function Promociones() {
  const [resumen, setResumen] = useState<ResumenDeNotificaciones | null>(null);
  const [lista, setLista] = useState<Promocion[] | null>(null);
  const [productos, setProductos] = useState<ProductoDeAbasto[]>([]);
  const [borrador, setBorrador] = useState<Borrador>(BORRADOR_VACIO);
  const [clave, setClave] = useState(nuevaClave);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([cargarResumen(), cargarPromociones()]);
      setResumen(r);
      setLista(p);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void cargar();
    // Los productos son un extra para la promoción: si Catálogo no responde, se manda igual sin producto
    graphql<{ misProductos: ProductoDeAbasto[] }>(PRODUCTOS_DE_ABASTO)
      .then((d) => setProductos([...d.misProductos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))))
      .catch(() => undefined);
  }, [cargar]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  const telefonos = resumen?.telefonos ?? 0;
  const falta = faltaParaEnviar(borrador, telefonos);
  const producto = useMemo(() => productos.find((p) => p.id === borrador.productoId) ?? null, [productos, borrador.productoId]);
  const cambiar = (parcial: Partial<Borrador>) => {
    setBorrador((b) => ({ ...b, ...parcial }));
    setConfirmando(false);
  };

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const p = await enviarPromocion(borrador, clave);
      setAviso(`«${p.titulo}»: ${textoDeResultado(p).toLowerCase()}.`);
      setBorrador(BORRADOR_VACIO);
      setClave(nuevaClave());
      setConfirmando(false);
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="cabecera">
        <h1 className="titulo-pantalla">Promociones</h1>
      </div>
      <p className="gris intro">Lo que mandes aquí le llega como notificación a todos los que tienen la app de Abasto, aunque la tengan cerrada. Si eliges un producto, tocarla abre su ficha.</p>

      {error && <p className="falla">{error}</p>}

      {resumen && (
        <div className="kpis">
          <div className="carta kpi">
            <span>Teléfonos con la app</span>
            <strong>{resumen.telefonos}</strong>
            <small>
              de {resumen.empresas} {resumen.empresas === 1 ? 'cuenta' : 'cuentas'}, con las notificaciones activadas
            </small>
          </div>
          <div className="carta kpi">
            <span>Notificaciones</span>
            <strong className={resumen.modo === 'firebase' ? 'promo-modo-activo' : 'promo-modo-prueba'}>{resumen.modo === 'firebase' ? 'Conectadas' : 'Modo prueba'}</strong>
            <small>{resumen.modo === 'firebase' ? 'Salen por Firebase a los teléfonos' : 'Falta la cuenta de Firebase en Conecta: se anotan, no salen'}</small>
          </div>
        </div>
      )}

      <div className="promo-armado">
        <form
          className="carta promo-formulario"
          onSubmit={(e) => {
            e.preventDefault();
            if (!falta) setConfirmando(true);
          }}
        >
          <h2 className="titulo-carta">Nueva promoción</h2>
          <label>
            <span className="promo-etiqueta">
              Título <small>{borrador.titulo.length}/{LARGO_DEL_TITULO}</small>
            </span>
            <input
              className="entrada"
              aria-label="Título de la promoción"
              maxLength={LARGO_DEL_TITULO}
              placeholder="Aceite Fino a Bs 14 la botella"
              value={borrador.titulo}
              onChange={(e) => cambiar({ titulo: e.target.value })}
            />
          </label>
          <label>
            <span className="promo-etiqueta">
              Mensaje <small>{borrador.mensaje.length}/{LARGO_DEL_MENSAJE}</small>
            </span>
            <textarea
              className="entrada"
              aria-label="Mensaje de la promoción"
              rows={3}
              maxLength={LARGO_DEL_MENSAJE}
              placeholder="Solo este fin de semana. Pídelo hoy y te llega mañana."
              value={borrador.mensaje}
              onChange={(e) => cambiar({ mensaje: e.target.value })}
            />
          </label>
          <label>
            <span className="promo-etiqueta">Producto (opcional)</span>
            <select className="entrada" aria-label="Producto de la promoción" value={borrador.productoId} onChange={(e) => cambiar({ productoId: e.target.value })}>
              <option value="">Sin producto: abre el Inicio</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} · {p.id}
                </option>
              ))}
            </select>
          </label>

          {confirmando ? (
            <div className="promo-confirmar" role="alert">
              <p>
                ¿Mandarla ahora? Le llega a <strong>{telefonos === 1 ? '1 teléfono' : `${telefonos} teléfonos`}</strong> y no se puede deshacer.
              </p>
              <div className="acciones">
                <button type="button" className="boton-secundario" disabled={enviando} onClick={() => setConfirmando(false)}>
                  Cancelar
                </button>
                <button type="button" className="boton-primario" disabled={enviando} onClick={() => void enviar()}>
                  {enviando ? 'Enviando…' : 'Sí, enviar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="acciones promo-pie">
              {falta && <small className="gris">{falta}</small>}
              <button className="boton-primario" disabled={!!falta}>
                Enviar a {telefonos === 1 ? '1 teléfono' : `${telefonos} teléfonos`}
              </button>
            </div>
          )}
        </form>

        <div className="promo-telefono" aria-label="Así se ve en el teléfono">
          <span className="gris">Así se ve en el teléfono</span>
          <div className="promo-pantalla">
            <div className="promo-hora">9:41</div>
            <div className="promo-notificacion">
              <div className="promo-app">
                <span className="promo-icono" aria-hidden="true">
                  Λ
                </span>
                Abasto · Promociones · ahora
              </div>
              <div className="promo-cuerpo">
                <div>
                  <strong>{borrador.titulo.trim() || 'Título de la promoción'}</strong>
                  <p>{borrador.mensaje.trim() || 'El mensaje que verán todos los que tienen la app.'}</p>
                </div>
                {producto?.foto && <img src={producto.foto} alt="" />}
              </div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="promo-subtitulo">Enviadas</h2>
      {!lista && !error && <p className="vacio">Cargando…</p>}
      {lista && !lista.length && <div className="carta vacio">Todavía no mandaste ninguna promoción.</div>}
      {lista?.map((p) => (
        <article key={p.id} className="carta promo-enviada" aria-label={`Promoción ${p.titulo}`}>
          <div>
            <strong>{p.titulo}</strong>
            <p>{p.mensaje}</p>
            <small className="gris">
              {cuando(p.creadaEn)}
              {p.productoId && ` · abre ${productos.find((x) => x.id === p.productoId)?.nombre ?? p.productoId}`}
            </small>
          </div>
          <span className={`insignia ${p.enviadas === p.destinatarios && p.destinatarios > 0 ? 'exito' : 'advertencia'}`}>{textoDeResultado(p)}</span>
        </article>
      ))}

      {!!resumen?.recientes.length && (
        <>
          <h2 className="promo-subtitulo">Últimas notificaciones</h2>
          <p className="gris intro">Las que salieron desde que Conecta arrancó, también las de los pedidos (confirmado, en camino, entregado).</p>
          <div className="carta promo-tabla">
            <table>
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Para</th>
                  <th>Tipo</th>
                  <th>Notificación</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {resumen.recientes.map((n, i) => (
                  <tr key={`${n.cuando}-${i}`}>
                    <td>{cuando(n.cuando)}</td>
                    <td>{n.orgId}</td>
                    <td>{etiquetaDeCanal(n.canal)}</td>
                    <td>
                      <strong>{n.titulo}</strong>
                      <br />
                      <small className="gris">{n.cuerpo}</small>
                    </td>
                    <td>{textoDeEnvio(n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {aviso && (
        <div className="aviso" role="status">
          {aviso}
        </div>
      )}
    </>
  );
}
