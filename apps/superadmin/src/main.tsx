import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@abasto/ui/tokens.css';
import '@abasto/ui/base.css';
import './superadmin.css';
import { APPS, appQueLeToca } from '@abasto/sesion';
import { App } from './App';
import { sesion } from './servicios';

const raiz = createRoot(document.getElementById('raiz')!);

sesion
  .asegurar()
  .then((usuario) => {
    // La misma sesión sirve en las dos apps: si a esta cuenta le toca la otra, va directo (sin pedir contraseña)
    const destino = appQueLeToca(usuario.roles, 'superadmin');
    if (destino) return window.location.replace(APPS[destino]);
    raiz.render(
      <StrictMode>
        <App usuario={usuario} />
      </StrictMode>,
    );
  })
  .catch((e: Error) => raiz.render(<p className="vacio">No se pudo iniciar sesión: {e.message}</p>));
