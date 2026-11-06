import { describe, expect, it } from 'vitest';
import { MODULOS } from './modulos';
import { SERVICIOS } from './servicios';

describe('Superadmin', () => {
  it('empieza por Tracción y Mayoristas (CU-01) y tiene todos sus módulos', () => {
    expect(MODULOS.map((m) => m.titulo)).toEqual(['Tracción', 'Mayoristas', 'Tiendas', 'Reclamos', 'Reportes', 'Integraciones', 'Sistema', 'Auditoría', 'Usuarios']);
  });

  it('vigila los cinco servicios', () => {
    expect(SERVICIOS.map((s) => s.tecnologia)).toEqual(['Spring Boot', 'Laravel', 'NestJS', 'NestJS', 'NestJS']);
  });
});
