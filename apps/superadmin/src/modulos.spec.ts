import { describe, expect, it } from 'vitest';
import { MODULOS } from './modulos';
import { SERVICIOS } from './servicios';

describe('Superadmin', () => {
  it('empieza por Tracción y tiene los módulos de la maqueta salvo Inicio', () => {
    expect(MODULOS.map((m) => m.titulo)).toEqual([
      'Tracción',
      'Sistema',
      'Auditoría',
      'Mayoristas',
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
