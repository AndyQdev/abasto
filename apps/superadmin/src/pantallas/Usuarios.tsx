import { useEffect, useState } from 'react';
import { graphql } from '../servicios';

interface Integrante {
  usuario: string;
  nombre: string;
  correo: string | null;
  activo: boolean;
}

const EQUIPO = `query Equipo { equipoDeAbasto { usuario nombre correo activo } }`;

/** Quién puede entrar al Superadmin. Solo para ver: dar o quitar el acceso se hace en la consola de Keycloak. */
export function Usuarios() {
  const [equipo, setEquipo] = useState<Integrante[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    graphql<{ equipoDeAbasto: Integrante[] }>(EQUIPO)
      .then((d) => setEquipo(d.equipoDeAbasto))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <>
      <div className="cabecera">
        <h1 className="titulo-pantalla">Usuarios</h1>
      </div>
      <p className="gris intro">Las personas del equipo de Abasto que entran aquí. Para dar o quitar el acceso, usa el rol «admin» en la consola de Keycloak.</p>

      {error && <p className="falla">{error}</p>}
      {!equipo && !error && <p className="vacio">Cargando…</p>}
      {equipo && (
        <div className="carta tabla-ancha">
          <table className="tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {equipo.map((p) => (
                <tr key={p.usuario}>
                  <td>{p.nombre || '—'}</td>
                  <td className="mono">{p.usuario}</td>
                  <td>{p.correo ?? '—'}</td>
                  <td>
                    <span className={`insignia ${p.activo ? 'exito' : 'error'}`}>{p.activo ? 'Activo' : 'Apagado'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
