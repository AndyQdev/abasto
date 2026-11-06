import { describe, expect, it } from 'vitest';
import { MODULOS } from './modulos';
import { SERVICIOS } from './servicios';

describe('Superadmin', () => {
  it('empieza por Tracción y Mayoristas (CU-01), y Reclamos no está hasta decidir cómo se devuelve el dinero', () => {
    expect(MODULOS.map((m) => m.titulo)).toEqual(['Tracción', 'Mayoristas', 'Tiendas', 'Reportes', 'Integraciones', 'Sistema', 'Auditoría', 'Usuarios']);
  });

  it('vigila los cinco servicios', () => {
    expect(SERVICIOS.map((s) => s.tecnologia)).toEqual(['Spring Boot', 'Laravel', 'NestJS', 'NestJS', 'NestJS']);
  });
});
