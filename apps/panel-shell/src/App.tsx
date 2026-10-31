import { useCallback, useEffect, useState } from 'react';
import { APPS, type Sesion, type Usuario } from '@abasto/sesion';
import { Microfrontend } from './Microfrontend';
import { MODULOS, moduloDe } from './navegacion';
import { ROUTER_URL } from './offline/config';
import { useSinSenal } from './offline/useSinSenal';
import { avisoDeVerificacion, MI_ORGANIZACION, type MiOrganizacion } from './verificacion';

const rutaActual = () => window.location.pathname.replace(/^\//, '') || 'inicio';

export function App({ sesion, usuario }: { sesion: Sesion; usuario: Usuario }) {
  const [ruta, setRuta] = useState(rutaActual);
  const [aviso, setAviso] = useState<string | null>(null);
  const [appsAbierto, setAppsAbierto] = useState(false);
  const modulo = moduloDe(ruta);

  const navegar = useCallback((destino: string) => {
    window.history.pushState({}, '', `/${destino}`);
    setRuta(destino);
  }, []);

  useEffect(() => {
    const atras = () => setRuta(rutaActual());
    // Los remotos piden navegar o mostrar un aviso con eventos que atraviesan el Shadow DOM
    const pedirNavegar = (e: Event) => navegar((e as CustomEvent<{ ruta: string }>).detail.ruta);
    const mostrarAviso = (e: Event) => setAviso((e as CustomEvent<{ texto: string }>).detail.texto);
    window.addEventListener('popstate', atras);
    document.addEventListener('abasto:navegar', pedirNavegar);
    document.addEventListener('abasto:aviso', mostrarAviso);
    return () => {
      window.removeEventListener('popstate', atras);
      document.removeEventListener('abasto:navegar', pedirNavegar);
      document.removeEventListener('abasto:aviso', mostrarAviso);
    };
  }, [navegar]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  const token = useCallback(() => sesion.token(), [sesion]);
  const conexion = useSinSenal(token, setAviso);
  const esMayorista = usuario.roles.includes('mayorista');
  const [organizacion, setOrganizacion] = useState<MiOrganizacion | null>(null);

  // CU-01: el mayorista recién registrado ve si está en revisión o por qué lo rechazaron
  useEffect(() => {
    if (!esMayorista) return;
    let vigente = true;
    void (async () => {
      try {
        const r = await fetch(ROUTER_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${await sesion.token()}` },
          body: JSON.stringify({ query: MI_ORGANIZACION }),
        });
        const cuerpo = (await r.json()) as { data?: { miOrganizacion: MiOrganizacion } };
        if (vigente && cuerpo.data) setOrganizacion(cuerpo.data.miOrganizacion);
      } catch {
        // Sin señal no se muestra el aviso: no es motivo para frenar el Panel
      }
    })();
    return () => {
      vigente = false;
    };
  }, [esMayorista, sesion]);
  const verificacion = avisoDeVerificacion(organizacion);

  return (
    <div className="panel">
      <aside className="lateral">
        <div className="marca">
          <span className="logo">A</span>
          <div>
            <strong>Abasto</strong>
            <small>Panel Mayorista</small>
          </div>
        </div>
        <nav>
          {MODULOS.map((m) => (
            <a
              key={m.ruta}
              href={`/${m.ruta}`}
              className={m.ruta === modulo.ruta ? 'activo' : undefined}
              aria-current={m.ruta === modulo.ruta ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                navegar(m.ruta);
              }}
            >
              {m.titulo}
            </a>
          ))}
        </nav>
        <div className="empresa">
          <strong>{usuario.orgNombre || usuario.orgId}</strong>
          <small>Santa Cruz, Bolivia</small>
        </div>
      </aside>

      <div className="contenido">
        <header className="superior">
          <input className="entrada buscador" placeholder="Buscar productos, tiendas o pedidos" aria-label="Buscar" />
          <div className="acciones">
            <div className="apps">
              <button className="boton-secundario" onClick={() => setAppsAbierto((v) => !v)} aria-expanded={appsAbierto}>
                Apps
              </button>
              {appsAbierto && (
                <div className="menu carta" role="menu">
                  <p className="titulo-seccion">Ya iniciaste sesión: cambia de app sin volver a entrar</p>
                  {usuario.roles.includes('admin') && (
                    <a href={APPS.superadmin} role="menuitem">Superadmin</a>
                  )}
                </div>
              )}
            </div>
            <span className="usuario">{usuario.nombre}</span>
            <button className="boton-secundario" onClick={() => void sesion.cerrar()}>
              Salir
            </button>
          </div>
        </header>

        {(!conexion.enLinea || conexion.pendientes > 0 || conexion.desdeCache) && (
          <div className={`sin-senal ${conexion.enLinea ? 'enviando' : ''}`} role="status">
            {conexion.enLinea ? 'Volvió la señal' : 'Sin conexión: ves los últimos datos guardados'}
            {conexion.pendientes > 0 && ` · ${conexion.pendientes} cambios esperando para enviarse`}
          </div>
        )}

        {verificacion && (
          <div className={`verificacion ${verificacion.tono}`} role="status">
            <strong>{verificacion.titulo}</strong>
            <span>{verificacion.detalle}</span>
          </div>
        )}

        <main>
          {esMayorista ? (
            <Microfrontend remoto={modulo.remoto} ruta={modulo.ruta} sesion={sesion} usuario={usuario} />
          ) : (
            <div className="carta">
              <strong>Tu cuenta no es de un mayorista.</strong>
              <p>
                El Panel es para vender. Para comprar, usa la app Abasto en tu teléfono con esta misma
                cuenta.
              </p>
            </div>
          )}
        </main>
      </div>

      {aviso && (
        <div className="aviso" role="status">
          {aviso}
        </div>
      )}
    </div>
  );
}
