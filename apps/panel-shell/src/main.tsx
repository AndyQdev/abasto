import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { APPS, appQueLeToca, crearSesion } from '@abasto/sesion';
import '@abasto/ui/tokens.css';
import '@abasto/ui/base.css';
import './panel.css';
import './halo.css';
import { App } from './App';
import { Registro } from './Registro';

// El service worker (PWA) solo existe en el build; en pnpm dev:panel no se registra
if (import.meta.env.PROD) void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));

const sesion = crearSesion({ clientId: 'abasto-panel' });
const raiz = createRoot(document.getElementById('raiz')!);

// CU-01: el registro de mayoristas es público, sin sesión
if (window.location.pathname.replace(/\/+$/, '') === '/registro') {
  raiz.render(
    <StrictMode>
      <Registro />
    </StrictMode>,
  );
} else {
  // Sin sesión, asegurar() manda a Keycloak; con la sesión de otra app de Abasto vuelve sin pedir contraseña
  void sesion
  .asegurar()
  .then((usuario) => {
    // La misma sesión sirve en las dos apps: si a esta cuenta le toca la otra, va directo (sin pedir contraseña)
    const destino = appQueLeToca(usuario.roles, 'panel');
    if (destino) return window.location.replace(APPS[destino]);
    raiz.render(
      <StrictMode>
        <App sesion={sesion} usuario={usuario} />
      </StrictMode>,
    );
  })
  .catch((e: Error) => raiz.render(<p className="vacio">No se pudo iniciar sesión: {e.message}</p>));
}
