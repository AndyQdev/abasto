/** Módulos del Superadmin según la maqueta (docs/uix-mockup/Abasto v1 – Abasto Backoffice…). */
export interface Modulo {
  ruta: string;
  titulo: string;
  fase?: string;
  detalle?: string;
}

export const MODULOS: Modulo[] = [
  // Primero: mientras Abasto vende por su cuenta, estos números son el argumento para sumar mayoristas
  { ruta: 'traccion', titulo: 'Tracción' },
  { ruta: 'sistema', titulo: 'Sistema' },
  { ruta: 'auditoria', titulo: 'Auditoría' },
  {
    ruta: 'mayoristas',
    titulo: 'Mayoristas',
    fase: 'F5',
    detalle: 'Mayoristas por verificar: NIT, documentos, representante. Aprobar, rechazar o pedir datos. Los datos son de Catálogo.',
  },
  { ruta: 'tiendas', titulo: 'Tiendas', fase: 'F5', detalle: 'Tiendas por ciudad, tipo y estado; suspender una cuenta.' },
  {
    ruta: 'usuarios',
    titulo: 'Usuarios',
    fase: 'F5',
    detalle: 'Usuarios internos y permisos por rol: Superadmin, Operaciones, Soporte, Verificador, Auditor (roles de Keycloak).',
  },
  {
    ruta: 'reclamos',
    titulo: 'Reclamos',
    fase: 'F5',
    detalle: 'Reclamos de tiendas y mayoristas. Aprobar un reclamo dispara la saga de devolución en Pedidos.',
  },
  { ruta: 'reportes', titulo: 'Reportes', fase: 'F5', detalle: 'Pedidos por semana, GMV por ciudad y crecimiento de tiendas activas.' },
  {
    ruta: 'integraciones',
    titulo: 'Integraciones',
    fase: 'F5',
    detalle: 'Llaves de API, suscripciones de webhooks y eventos que fallaron, con reenvío. Los datos son de Conecta.',
  },
];
