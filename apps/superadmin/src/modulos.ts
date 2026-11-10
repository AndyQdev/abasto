/** Módulos del Superadmin según la maqueta (docs/uix-mockup/Abasto v1 – Abasto Backoffice…). */
export interface Modulo {
  ruta: string;
  titulo: string;
}

export const MODULOS: Modulo[] = [
  // Primero: mientras Abasto vende por su cuenta, estos números son el argumento para sumar mayoristas
  { ruta: 'traccion', titulo: 'Tracción' },
  // CU-01: los que se registran en el Panel esperan aquí la verificación
  { ruta: 'mayoristas', titulo: 'Mayoristas' },
  { ruta: 'tiendas', titulo: 'Tiendas' },
  // CU-16: lo que las tiendas reportan; Abasto lo resuelve a mano y aquí lo anota
  { ruta: 'reclamos', titulo: 'Reclamos' },
  // Notificaciones push (10/11): una promoción le llega a todos los que tienen la app
  { ruta: 'promociones', titulo: 'Promociones' },
  { ruta: 'reportes', titulo: 'Reportes' },
  // CU-10: las tiendas conectadas con su e-commerce y los avisos que no llegaron
  { ruta: 'integraciones', titulo: 'Integraciones' },
  { ruta: 'sistema', titulo: 'Sistema' },
  { ruta: 'auditoria', titulo: 'Auditoría' },
  { ruta: 'usuarios', titulo: 'Usuarios' },
];
