import { appQueLeToca } from '@abasto/sesion';
import { describe, expect, it } from 'vitest';

describe('Cada cuenta entra a la app web que le toca', () => {
  it('un mayorista que llega al Superadmin pasa al Panel', () => {
    expect(appQueLeToca(['mayorista', 'tienda'], 'superadmin')).toBe('panel');
  });

  it('un admin que llega al Panel pasa al Superadmin', () => {
    expect(appQueLeToca(['admin'], 'panel')).toBe('superadmin');
  });

  it('quien es mayorista y admin (Abasto) se queda donde entró y puede cambiar desde el menú', () => {
    expect(appQueLeToca(['mayorista', 'admin'], 'panel')).toBeNull();
    expect(appQueLeToca(['mayorista', 'admin'], 'superadmin')).toBeNull();
  });

  it('una cuenta solo de tienda no tiene app web: se queda y ve cómo cerrar sesión', () => {
    expect(appQueLeToca(['tienda'], 'panel')).toBeNull();
    expect(appQueLeToca(['tienda'], 'superadmin')).toBeNull();
  });
});
