import { RECORTE, SIMBOLO, TINTAS, type Tinta } from '@abasto/ui/marca';
import { useId } from 'react';

/** El símbolo de Abasto (10/11): la «A» lima con el paquete ámbar de travesaño (`packages/ui/marca.ts`). */
export function Simbolo({ tamano = 36, tinta = TINTAS.sobreOscuro }: { tamano?: number; tinta?: Tinta }) {
  const id = 'abasto-' + useId().replace(/:/g, '');
  const s = SIMBOLO;
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <path clipRule="evenodd" d={RECORTE} />
        </clipPath>
      </defs>
      <path d={s.patas} fill="none" stroke={tinta.patas} strokeWidth={s.grosor} strokeLinecap="round" strokeLinejoin="round" clipPath={`url(#${id})`} />
      <rect x={s.paquete.x} y={s.paquete.y} width={s.paquete.ancho} height={s.paquete.alto} rx={s.paquete.radio} fill={tinta.paquete} />
      {tinta.cinta && <rect x={s.cinta.x} y={s.cinta.y} width={s.cinta.ancho} height={s.cinta.alto} fill={tinta.cinta} />}
    </svg>
  );
}
