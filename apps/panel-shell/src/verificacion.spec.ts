import { describe, expect, it } from 'vitest';
import { avisoDeVerificacion, type MiOrganizacion } from './verificacion';

const org = (parcial: Partial<MiOrganizacion>): MiOrganizacion => ({
  id: 'x',
  nombre: 'El Trébol',
  tipo: 'mayorista',
  estadoVerificacion: 'PENDIENTE',
  motivoRechazo: null,
  ...parcial,
});

describe('aviso de verificación en el Panel (CU-01)', () => {
  it('en revisión: puede cargar productos, salen al verificarlo', () => {
    expect(avisoDeVerificacion(org({}))).toMatchObject({ tono: 'revision', titulo: 'Tu empresa está en revisión' });
  });

  it('rechazado: muestra el motivo que escribió Abasto', () => {
    const aviso = avisoDeVerificacion(org({ estadoVerificacion: 'RECHAZADO', motivoRechazo: 'El NIT no corresponde a la empresa' }));
    expect(aviso?.detalle).toContain('El NIT no corresponde a la empresa');
  });

  it('verificado, una tienda o sin datos: nada', () => {
    expect(avisoDeVerificacion(org({ estadoVerificacion: 'VERIFICADO' }))).toBeNull();
    expect(avisoDeVerificacion(org({ tipo: 'tienda' }))).toBeNull();
    expect(avisoDeVerificacion(null)).toBeNull();
  });
});
