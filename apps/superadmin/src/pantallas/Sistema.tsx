import { useCallback, useEffect, useState } from 'react';
import { SERVICIOS } from '../servicios';

type Estado = { ok: boolean; ms: number; detalle: string };

/** Salud del sistema: pregunta /salud a cada servicio y muestra cuánto tardó. */
export function Sistema() {
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [revisado, setRevisado] = useState<string>('');

  const revisar = useCallback(async () => {
    const resultados = await Promise.all(
      SERVICIOS.map(async (s) => {
        const inicio = performance.now();
        try {
          const r = await fetch(s.url, { signal: AbortSignal.timeout(4000) });
          return [s.id, { ok: r.ok, ms: Math.round(performance.now() - inicio), detalle: r.ok ? 'Responde' : `HTTP ${r.status}` }] as const;
        } catch {
          return [s.id, { ok: false, ms: Math.round(performance.now() - inicio), detalle: 'No responde' }] as const;
        }
      }),
    );
    setEstados(Object.fromEntries(resultados));
    setRevisado(new Date().toLocaleTimeString('es-BO'));
  }, []);

  useEffect(() => {
    void revisar();
  }, [revisar]);

  const caidos = SERVICIOS.filter((s) => estados[s.id] && !estados[s.id].ok).length;

  return (
    <>
      <div className="cabecera">
        <h1 className="titulo-pantalla">Salud del sistema</h1>
        <div className="contadores">
          <div>
            <strong>{SERVICIOS.length - caidos}</strong>responden
          </div>
          <div>
            <strong>{caidos}</strong>no responden
          </div>
        </div>
      </div>
      <div className="filtros">
        <span className="gris">Verificado {revisado}</span>
        <span className="relleno" />
        <button className="boton-primario" onClick={() => void revisar()}>
          Actualizar
        </button>
      </div>
      <div className="carta">
        <table className="tabla">
          <thead>
            <tr>
              <th>Servicio</th>
              <th>Tecnología</th>
              <th className="num">Última respuesta</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {SERVICIOS.map((s) => {
              const e = estados[s.id];
              return (
                <tr key={s.id}>
                  <td>
                    <strong>{s.nombre}</strong>
                  </td>
                  <td>{s.tecnologia}</td>
                  <td className="num">{e ? `${e.ms} ms` : '—'}</td>
                  <td>
                    <span className={`insignia ${!e ? 'neutro' : e.ok ? 'exito' : 'error'}`}>{e ? e.detalle : 'Revisando'}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="gris">Las colas de RabbitMQ y los mensajes muertos se ven en http://localhost:15680 (tarea de F5: traerlos aquí).</p>
    </>
  );
}
