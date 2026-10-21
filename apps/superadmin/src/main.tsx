import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@abasto/ui/tokens.css';
import '@abasto/ui/base.css';
import './superadmin.css';
import { App } from './App';
import { sesion } from './servicios';

const raiz = createRoot(document.getElementById('raiz')!);

sesion
  .asegurar()
  .then((usuario) =>
    raiz.render(
      <StrictMode>
        <App usuario={usuario} />
      </StrictMode>,
    ),
  )
  .catch((e: Error) => raiz.render(<p className="vacio">No se pudo iniciar sesión: {e.message}</p>));
