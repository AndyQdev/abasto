import type { NombreDeIcono } from './iconos';
import type { NombreDeRemoto } from './remotos';

/** Los módulos del Panel. Cada uno lo atiende un microfrontend. */
export interface Modulo {
  ruta: string;
  titulo: string;
  remoto: NombreDeRemoto;
  icono: NombreDeIcono;
  /** Los cinco de todos los días van en el menú flotante; el resto, bajo «Más» */
  principal?: boolean;
}

export const MODULOS: Modulo[] = [
  { ruta: 'inicio', titulo: 'Inicio', remoto: 'gestion', icono: 'inicio', principal: true },
  { ruta: 'productos', titulo: 'Productos', remoto: 'gestion', icono: 'productos', principal: true },
  { ruta: 'pedidos', titulo: 'Pedidos', remoto: 'gestion', icono: 'pedidos', principal: true },
  // Lista de compras: Abasto compra bajo pedido (modelo de lanzamiento, 29/10)
  { ruta: 'compras', titulo: 'Compras', remoto: 'gestion', icono: 'compras', principal: true },
  { ruta: 'clientes', titulo: 'Clientes', remoto: 'gestion', icono: 'clientes', principal: true },
  { ruta: 'cuentas', titulo: 'Cuentas por cobrar', remoto: 'gestion', icono: 'cuentas' },
  { ruta: 'agentes', titulo: 'Agentes', remoto: 'inteligencia', icono: 'agentes' },
  { ruta: 'reportes', titulo: 'Reportes', remoto: 'inteligencia', icono: 'reportes' },
  { ruta: 'tableros', titulo: 'Tableros', remoto: 'inteligencia', icono: 'tableros' },
  { ruta: 'conecta', titulo: 'Conecta', remoto: 'gestion', icono: 'conecta' },
];

export const PRINCIPALES = MODULOS.filter((m) => m.principal);
export const DE_MAS = MODULOS.filter((m) => !m.principal);

/** Accesos rápidos del dock derecho (además de Alertas y Ayuda, que abren su panel). */
export const ACCESOS_DEL_DOCK = MODULOS.filter((m) => ['agentes', 'reportes', 'tableros'].includes(m.ruta));

/** La ruta sin la búsqueda: «productos?q=arroz» → «productos». */
export function moduloDe(ruta: string): Modulo {
  const limpia = ruta.split('?')[0];
  return MODULOS.find((m) => m.ruta === limpia) ?? MODULOS[0];
}

/** El buscador del header manda a donde tiene sentido: un código de pedido a Pedidos, lo demás a Productos. */
export function destinoDeBusqueda(texto: string): string | null {
  const limpio = texto.trim();
  if (!limpio) return null;
  const ruta = /^(a-?)?\d{3,}$/i.test(limpio) ? 'pedidos' : 'productos';
  return `${ruta}?q=${encodeURIComponent(limpio)}`;
}
