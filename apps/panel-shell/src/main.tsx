import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { crearSesion } from '@abasto/sesion';
import '@abasto/ui/tokens.css';
import '@abasto/ui/base.css';
import './panel.css';
import { App } from './App';

// El service worker (PWA) solo existe en el build; en pnpm dev:panel no se registra
if (import.meta.env.PROD) void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));

const sesion = crearSesion({ clientId: 'abasto-panel' });
const raiz = createRoot(document.getElementById('raiz')!);

// Sin sesión, asegurar() manda a Keycloak; con la sesión de otra app de Abasto vuelve sin pedir contraseña
sesion
  .asegurar()
  .then((usuario) =>
    raiz.render(
      <StrictMode>
        <App sesion={sesion} usuario={usuario} />
      </StrictMode>,
    ),
  )
  .catch((e: Error) => raiz.render(<p className="vacio">No se pudo iniciar sesión: {e.message}</p>));
