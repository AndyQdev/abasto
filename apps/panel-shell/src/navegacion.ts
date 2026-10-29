import type { NombreDeRemoto } from './remotos';

/** Los módulos del Panel, tal como están en la maqueta. Cada uno lo atiende un microfrontend. */
export interface Modulo {
  ruta: string;
  titulo: string;
  remoto: NombreDeRemoto;
}

export const MODULOS: Modulo[] = [
  { ruta: 'inicio', titulo: 'Inicio', remoto: 'gestion' },
  { ruta: 'productos', titulo: 'Productos', remoto: 'gestion' },
  { ruta: 'pedidos', titulo: 'Pedidos', remoto: 'gestion' },
  // Lista de compras: Abasto compra bajo pedido (modelo de lanzamiento, 29/10)
  { ruta: 'compras', titulo: 'Compras', remoto: 'gestion' },
  { ruta: 'clientes', titulo: 'Clientes', remoto: 'gestion' },
  { ruta: 'cuentas', titulo: 'Cuentas por cobrar', remoto: 'gestion' },
  { ruta: 'agentes', titulo: 'Agentes', remoto: 'inteligencia' },
  { ruta: 'reportes', titulo: 'Reportes', remoto: 'inteligencia' },
  { ruta: 'conecta', titulo: 'Conecta', remoto: 'gestion' },
];

export function moduloDe(ruta: string): Modulo {
  return MODULOS.find((m) => m.ruta === ruta) ?? MODULOS[0];
}
