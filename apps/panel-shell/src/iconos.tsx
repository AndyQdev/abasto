import { COLOR as COLOR_MARCA, RECORTE, SIMBOLO, TINTAS, type Tinta } from '@abasto/ui/marca';
import { useId } from 'react';

/** Iconos lineales del Panel (trazos al estilo Lucide, 24 × 24). Se dibujan con el color del texto. */
const TRAZOS = {
  inicio: (
    <>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  productos: (
    <>
      <path d="M11 21.7a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7z" />
      <path d="M12 22V12" />
      <path d="m3.3 7 8.7 5 8.7-5" />
    </>
  ),
  pedidos: (
    <>
      <rect width="8" height="4" x="8" y="2" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" />
    </>
  ),
  compras: (
    <>
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </>
  ),
  clientes: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  mas: (
    <>
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
      <circle cx="5" cy="12" r="1.2" />
    </>
  ),
  cuentas: (
    <>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </>
  ),
  conecta: (
    <>
      <path d="M12 22v-5M9 8V2M15 8V2" />
      <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
    </>
  ),
  agentes: (
    <>
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
    </>
  ),
  reportes: (
    <>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9M13 17V5M8 17v-3" />
    </>
  ),
  tableros: (
    <>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </>
  ),
  ayuda: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
    </>
  ),
  alertas: (
    <>
      <path d="M10.27 21a2 2 0 0 0 3.46 0" />
      <path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33" />
    </>
  ),
  buscar: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  usuario: (
    <>
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </>
  ),
  abajo: <path d="m6 9 6 6 6-6" />,
  plegar: <path d="m6 17 5-5-5-5M13 17l5-5-5-5" />,
  desplegar: <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />,
  salir: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  apps: (
    <>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </>
  ),
  cerrar: <path d="M18 6 6 18M6 6l12 12" />,
  instalar: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
} as const;

export type NombreDeIcono = keyof typeof TRAZOS;

export function Icono({ nombre, tamano = 22 }: { nombre: NombreDeIcono; tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}

/**
 * El símbolo de Abasto (10/11): la «A» lima con el paquete ámbar de travesaño. Con `conFondo`, sobre el cuadrado
 * redondeado verde bosque (el ícono de la app). La geometría es la de `packages/ui/marca.ts`.
 */
export function Simbolo({ tamano = 44, conFondo = true, tinta = TINTAS.sobreOscuro }: { tamano?: number; conFondo?: boolean; tinta?: Tinta }) {
  const id = 'abasto-' + useId().replace(/:/g, '');
  const s = SIMBOLO;
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <path clipRule="evenodd" d={RECORTE} />
        </clipPath>
      </defs>
      {conFondo && <rect width="100" height="100" rx="27" fill={COLOR_MARCA.bosque} />}
      <g transform={conFondo ? 'translate(14 14) scale(0.72)' : undefined}>
        <path d={s.patas} fill="none" stroke={tinta.patas} strokeWidth={s.grosor} strokeLinecap="round" strokeLinejoin="round" clipPath={`url(#${id})`} />
        <rect x={s.paquete.x} y={s.paquete.y} width={s.paquete.ancho} height={s.paquete.alto} rx={s.paquete.radio} fill={tinta.paquete} />
        {tinta.cinta && <rect x={s.cinta.x} y={s.cinta.y} width={s.cinta.ancho} height={s.cinta.alto} fill={tinta.cinta} />}
      </g>
    </svg>
  );
}
