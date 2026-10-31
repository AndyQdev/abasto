import { useEffect, useState } from 'react';
import { APPS, type Usuario } from '@abasto/sesion';
import { MODULOS } from './modulos';
import { Auditoria } from './pantallas/Auditoria';
import { Sistema } from './pantallas/Sistema';
import { Traccion } from './pantallas/Traccion';
import { sesion } from './servicios';

const rutaActual = () => window.location.pathname.replace(/^\//, '') || 'traccion';

export function App({ usuario }: { usuario: Usuario }) {
  const [ruta, setRuta] = useState(rutaActual);
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
          <strong>Abasto</strong>
          <small>Backoffice</small>
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
          {usuario.roles.includes('mayorista') && <a href={APPS.panel}>Ir al Panel Mayorista</a>}
          <button className="boton-secundario" onClick={() => void sesion.cerrar()}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main>
        {modulo.ruta === 'traccion' && <Traccion />}
        {modulo.ruta === 'sistema' && <Sistema />}
        {modulo.ruta === 'auditoria' && <Auditoria />}
        {modulo.fase && (
          <>
            <div className="cabecera">
              <h1 className="titulo-pantalla">{modulo.titulo}</h1>
            </div>
            <div className="carta">
              <p>
                <strong>Este módulo se construye en la fase {modulo.fase}.</strong>
              </p>
              <p>{modulo.detalle}</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
