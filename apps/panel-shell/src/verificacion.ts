/**
 * CU-01 en el Panel: un mayorista recién registrado entra igual, pero ve en qué está su verificación.
 * Mientras está en revisión puede cargar productos; salen en la app recién cuando Abasto lo verifica.
 */
export interface MiOrganizacion {
  id: string;
  nombre: string;
  tipo: string;
  estadoVerificacion: string;
  motivoRechazo: string | null;
}

export const MI_ORGANIZACION = `query MiOrganizacion { miOrganizacion { id nombre tipo estadoVerificacion motivoRechazo } }`;

/** El aviso de arriba del Panel; null si ya está verificado (no molesta). */
export function avisoDeVerificacion(o: MiOrganizacion | null): { tono: 'revision' | 'rechazo'; titulo: string; detalle: string } | null {
  if (!o || o.tipo !== 'mayorista') return null;
  if (o.estadoVerificacion === 'PENDIENTE') {
    return {
      tono: 'revision',
      titulo: 'Tu empresa está en revisión',
      detalle: 'Ya puedes cargar tus productos. Salen en la app de las tiendas apenas Abasto verifique tu NIT (un día hábil).',
    };
  }
  if (o.estadoVerificacion === 'RECHAZADO') {
    return {
      tono: 'rechazo',
      titulo: 'No pudimos verificar tu empresa',
      detalle: `${o.motivoRechazo ?? 'Revisa tus datos'}. Escríbenos a soporte@abasto.bo y lo revisamos de nuevo.`,
    };
  }
  return null;
}
