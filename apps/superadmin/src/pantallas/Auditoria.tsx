import { useEffect, useState } from 'react';
import { conToken, URLS } from '../servicios';

interface Registro {
  SK: string;
  orgId: string;
  usuarioId: string;
  origen: 'analista' | 'mcp' | 'agente';
  sql: string;
  resultado: 'ok' | 'rechazada' | 'error';
  filas?: number;
  motivo?: string;
  registradaEn: string;
}

const RESULTADO: Record<Registro['resultado'], [string, string]> = {
  ok: ['Exitosa', 'exito'],
  rechazada: ['Rechazada', 'error'],
  error: ['Falló', 'alto'],
};

/** Auditoría del MCP: cada consulta que un agente, el Analista o un cliente MCP hizo sobre los datos de una empresa. */
export function Auditoria() {
  const [orgId, setOrgId] = useState('lp');
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    conToken<Registro[]>(`${URLS.asistente}/v1/auditoria?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => {
        setRegistros(r);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [orgId]);

  return (
    <>
      <div className="cabecera">
        <h1 className="titulo-pantalla">Auditoría del MCP</h1>
        <div className="contadores">
          <div>
            <strong>{registros.filter((r) => r.resultado === 'rechazada').length}</strong>rechazadas
          </div>
        </div>
      </div>
      <div className="filtros">
        <select className="entrada" value={orgId} onChange={(e) => setOrgId(e.target.value)} aria-label="Empresa">
          <option value="lp">Distribuidora Los Pozos</option>
          <option value="lr">Importadora La Ramada</option>
        </select>
      </div>
      {error && <p className="falla">{error}</p>}
      <div className="carta">
        {!registros.length ? (
          <p className="vacio">No hay consultas registradas para esta empresa.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Cuándo</th>
                <th>Origen</th>
                <th>Consulta</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.SK}>
                  <td>{new Date(r.registradaEn).toLocaleString('es-BO')}</td>
                  <td>{r.origen}</td>
                  <td className="mono sql">{r.sql.replace(/\s+/g, ' ').slice(0, 140)}</td>
                  <td>
                    <span className={`insignia ${RESULTADO[r.resultado][1]}`}>{RESULTADO[r.resultado][0]}</span>
                    <span className="gris">{r.motivo ?? (r.filas !== undefined ? `${r.filas} filas` : '')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
