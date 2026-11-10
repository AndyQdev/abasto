import { useEffect, useState } from 'react';
import { APPS, type Usuario } from '@abasto/sesion';
import { MODULOS } from './modulos';
import { Auditoria } from './pantallas/Auditoria';
import { Integraciones } from './pantallas/Integraciones';
import { Promociones } from './pantallas/Promociones';
import { Mayoristas } from './pantallas/Mayoristas';
import { Reclamos } from './pantallas/Reclamos';
import { Reportes } from './pantallas/Reportes';
import { Tiendas } from './pantallas/Tiendas';
import { Usuarios } from './pantallas/Usuarios';
import { Sistema } from './pantallas/Sistema';
import { Traccion } from './pantallas/Traccion';
import { sesion } from './servicios';
import { Simbolo } from './Simbolo';

const rutaActual = () => window.location.pathname.replace(/^\//, '') || 'traccion';

export function App({ usuario }: { usuario: Usuario }) {
  const [ruta, setRuta] = useState(rutaActual);
  const [appsAbierto, setAppsAbierto] = useState(false);
  const modulo = MODULOS.find((m) => m.ruta === ruta) ?? MODULOS[0];

  useEffect(() => {
    const atras = () => setRuta(rutaActual());
    window.addEventListener('popstate', atras);
    return () => window.removeEventListener('popstate', atras);
  }, []);

  if (!usuario.roles.includes('admin')) {
    return (
      <div className="carta solo-admin">
        <strong>El Superadmin es solo para el equipo de Abasto.</strong>
        <p>
          Tu cuenta entra a la app Abasto en el teléfono
          {usuario.roles.includes('mayorista') && (
            <>
              {' '}y al <a href={APPS.panel}>Panel Mayorista</a>
            </>
          )}
          .
        </p>
        <button className="boton-secundario" onClick={() => void sesion.cerrar()}>
          Cerrar sesión y entrar con otra cuenta
        </button>
      </div>
    );
  }

  return (
    <div className="superadmin">
      <aside className="lateral">
        <div className="marca">
          <Simbolo tamano={38} />
          <div>
            <strong>Abasto</strong>
            <small>Backoffice</small>
          </div>
        </div>
        <nav>
          {MODULOS.map((m) => (
            <a
              key={m.ruta}
              href={`/${m.ruta}`}
              className={m.ruta === modulo.ruta ? 'activo' : undefined}
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', `/${m.ruta}`);
                setRuta(m.ruta);
              }}
            >
              {m.titulo}
            </a>
          ))}
        </nav>
        <div className="pie">
          <strong>{usuario.nombre}</strong>
          <small>Equipo interno de Abasto</small>
        </div>
      </aside>
      <div className="contenido">
        {/* Igual que en el Panel: cambiar de app con la misma sesión y salir */}
        <header className="superior">
          <span />
          <div className="acciones">
            <div className="apps">
              <button className="boton-secundario" onClick={() => setAppsAbierto((v) => !v)} aria-expanded={appsAbierto}>
                Apps
              </button>
              {appsAbierto && (
                <div className="menu carta" role="menu">
                  <p className="titulo-seccion">Ya iniciaste sesión: cambia de app sin volver a entrar</p>
                  {usuario.roles.includes('mayorista') && (
                    <a href={APPS.panel} role="menuitem">Panel Mayorista</a>
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
      <main>
        {modulo.ruta === 'traccion' && <Traccion />}
        {modulo.ruta === 'sistema' && <Sistema />}
        {modulo.ruta === 'auditoria' && <Auditoria />}
        {modulo.ruta === 'mayoristas' && <Mayoristas />}
        {modulo.ruta === 'tiendas' && <Tiendas />}
        {modulo.ruta === 'reclamos' && <Reclamos />}
        {modulo.ruta === 'promociones' && <Promociones />}
        {modulo.ruta === 'reportes' && <Reportes />}
        {modulo.ruta === 'integraciones' && <Integraciones />}
        {modulo.ruta === 'usuarios' && <Usuarios />}
      </main>
      </div>
    </div>
  );
}
