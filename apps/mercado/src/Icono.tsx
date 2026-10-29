/** Iconos de trazo (estilo Lucide) que usa la maqueta de Mercado. */
const TRAZOS = {
  buscar: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  camara: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" /><circle cx="12" cy="13" r="3" /></>,
  carrito: <><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L22 7H5.1" /></>,
  volver: <path d="m15 18-6-6 6-6" />,
  seguir: <path d="m9 18 6-6-6-6" />,
  mas: <path d="M5 12h14M12 5v14" />,
  menos: <path d="M5 12h14" />,
  candado: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  tienda: <><path d="m3 9 2-5h14l2 5" /><path d="M4 9v11h16V9" /><path d="M3 9h18" /><path d="M10 20v-5h4v5" /></>,
  caja: <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5M12 13v8" /></>,
  ubicacion: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>,
  verificado: <><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  borrar: <path d="M18 6 6 18M6 6l12 12" />,
  sinSenal: <><path d="M2 2l20 20" /><path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.3-1.6M12 20h.01" /></>,
} as const;

export type NombreDeIcono = keyof typeof TRAZOS;

export function Icono({ nombre, tamano = 20 }: { nombre: NombreDeIcono; tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}
