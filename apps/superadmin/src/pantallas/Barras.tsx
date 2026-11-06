import { escala } from '../reportes';
import { semana } from '../traccion';

export interface BarraDeSemana {
  desde: string;
  valor: number;
  /** Lo que se escribe sobre la barra; vacío si no hay nada */
  etiqueta: string;
  /** Lo que se lee al pasar el mouse */
  detalle: string;
}

/**
 * Una serie por semana. El alto se mide sobre la pista, sin contar los textos: si se midiera sobre toda la columna,
 * el navegador achicaría la barra más alta y 78 y 103 se verían casi iguales.
 */
export function BarrasPorSemana({ titulo, barras }: { titulo: string; barras: BarraDeSemana[] }) {
  const altos = escala(barras.map((b) => b.valor));
  return (
    <div className="barras" role="img" aria-label={`${titulo}: ${barras.map((b) => `${semana(b.desde)}, ${b.detalle}`).join('; ')}`}>
      {barras.map((b, i) => (
        <div key={b.desde} className="barra-col">
          <span className="barra-pista">
            <span className="barra" style={{ height: `${altos[i]}%` }}>
              {!!b.valor && <span className="barra-valor">{b.etiqueta}</span>}
            </span>
            <span className="barra-tip" role="tooltip">
              Semana del {semana(b.desde)}: {b.detalle}
            </span>
          </span>
          <span className="barra-etiqueta">{semana(b.desde)}</span>
        </div>
      ))}
    </div>
  );
}
