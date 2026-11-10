import { useState, type ReactNode } from 'react';
import { Simbolo } from './iconos';
import { ROUTER_URL } from './offline/config';
import { CIUDADES, mensajeDeError, registrar, revisar, VACIO, type DatosDeRegistro } from './datos-de-registro';

/**
 * CU-01 · «Vende en Abasto»: el mayorista se registra solo, sin sesión (`/registro`).
 * Queda «en revisión» hasta que Abasto lo verifica en el Superadmin; mientras, ya puede entrar al Panel
 * con su correo y contraseña y preparar su catálogo.
 */
export function Registro() {
  const [datos, setDatos] = useState<DatosDeRegistro>(VACIO);
  const [tocados, setTocados] = useState<Partial<Record<keyof DatosDeRegistro, boolean>>>({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);
  const errores = revisar(datos);
  const valido = Object.keys(errores).length === 0;

  const campo = (k: keyof DatosDeRegistro) => ({
    value: datos[k],
    onChange: (e: { target: { value: string } }) => setDatos((d) => ({ ...d, [k]: e.target.value })),
    onBlur: () => setTocados((t) => ({ ...t, [k]: true })),
    'aria-invalid': !!(tocados[k] && errores[k]),
  });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setTocados({ empresa: true, nit: true, ciudad: true, representante: true, telefono: true, correo: true, clave: true });
    if (!valido) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await registrar(ROUTER_URL, datos);
      setListo(r.nombre);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <div className="registro">
        <div className="carta registro-listo">
          <span className="sello" aria-hidden>
            ✓
          </span>
          <h1 className="titulo-pantalla">Recibimos tu solicitud</h1>
          <p>
            <strong>{listo}</strong> quedó <span className="insignia advertencia">En revisión</span>. El equipo de Abasto revisa tu NIT y te llama al{' '}
            {datos.telefono} en un día hábil.
          </p>
          <p className="gris">Mientras tanto ya puedes entrar al Panel y cargar tus productos: salen en la app apenas te verifiquemos.</p>
          <a className="boton-primario boton-enlace" href="/">
            Entrar al Panel con {datos.correo.trim().toLowerCase()}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="registro">
      <section className="registro-intro">
        <div className="marca">
          <Simbolo tamano={40} />
          <strong>Abasto</strong>
        </div>
        <h1>Vende al por mayor a las tiendas de tu ciudad</h1>
        <ul>
          <li>Las tiendas te piden desde la app, con QR, contra entrega o a crédito.</li>
          <li>Tus precios son privados: solo los ven las tiendas que tú apruebas.</li>
          <li>Sin costo para empezar. Te verificamos en un día hábil.</li>
        </ul>
      </section>

      <form className="carta registro-form" onSubmit={(e) => void enviar(e)} noValidate>
        <h2 className="titulo-carta">Registra tu empresa</h2>
        <Campo etiqueta="Nombre de la empresa" error={tocados.empresa ? errores.empresa : undefined}>
          <input className="entrada" autoComplete="organization" placeholder="Distribuidora El Trébol" {...campo('empresa')} />
        </Campo>
        <div className="fila">
          <Campo etiqueta="NIT" error={tocados.nit ? errores.nit : undefined}>
            <input className="entrada mono" inputMode="numeric" placeholder="1023456029" {...campo('nit')} />
          </Campo>
          <Campo etiqueta="Ciudad" error={tocados.ciudad ? errores.ciudad : undefined}>
            <select className="entrada" {...campo('ciudad')}>
              {CIUDADES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Campo>
        </div>
        <Campo etiqueta="Representante (nombre y apellido)" error={tocados.representante ? errores.representante : undefined}>
          <input className="entrada" autoComplete="name" placeholder="Ana Rojas" {...campo('representante')} />
        </Campo>
        <div className="fila">
          <Campo etiqueta="Celular" error={tocados.telefono ? errores.telefono : undefined}>
            <input className="entrada" type="tel" autoComplete="tel" placeholder="71234567" {...campo('telefono')} />
          </Campo>
          <Campo etiqueta="Correo" error={tocados.correo ? errores.correo : undefined}>
            <input className="entrada" type="email" autoComplete="email" placeholder="ventas@eltrebol.bo" {...campo('correo')} />
          </Campo>
        </div>
        <Campo etiqueta="Contraseña para entrar al Panel" error={tocados.clave ? errores.clave : undefined}>
          <input className="entrada" type="password" autoComplete="new-password" placeholder="Al menos 8 caracteres" {...campo('clave')} />
        </Campo>

        {error && (
          <p className="falla" role="alert">
            {error}
          </p>
        )}
        <button className="boton-primario" type="submit" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar solicitud'}
        </button>
        <p className="gris pie-form">
          ¿Ya tienes cuenta? <a href="/">Entra al Panel</a>
        </p>
      </form>
    </div>
  );
}

function Campo({ etiqueta, error, children }: { etiqueta: string; error?: string; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      {children}
      {error && <small className="error-campo">{error}</small>}
    </label>
  );
}
