import { describe, expect, it } from 'vitest';
import { MODULOS } from './modulos';
import { SERVICIOS } from './servicios';

describe('Superadmin', () => {
  it('empieza por Tracción y Mayoristas (CU-01) y tiene los módulos de la maqueta salvo Inicio', () => {
    expect(MODULOS.map((m) => m.titulo)).toEqual([
      'Tracción',
      'Mayoristas',
      'Sistema',
      'Auditoría',
      'Tiendas',
      'Usuarios',
      'Reclamos',
      'Reportes',
      'Integraciones',
    ]);
  });

  it('vigila los cinco servicios', () => {
    expect(SERVICIOS.map((s) => s.tecnologia)).toEqual(['Spring Boot', 'Laravel', 'NestJS', 'NestJS', 'NestJS']);
  });
});
