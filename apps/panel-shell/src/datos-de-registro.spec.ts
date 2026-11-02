import { describe, expect, it, vi } from 'vitest';
import { limpiar, registrar, revisar, VACIO, type DatosDeRegistro } from './datos-de-registro';

const bien: DatosDeRegistro = {
  empresa: '  Distribuidora   El Trébol ',
  nit: '1023-456-029',
  ciudad: 'Santa Cruz',
  representante: ' Ana  Rojas ',
  telefono: '712 34 567',
  correo: ' Ventas@ElTrebol.BO ',
  clave: 'Trebol.2026',
};

describe('registro de mayoristas (CU-01)', () => {
  it('con todo bien no hay errores', () => {
    expect(revisar(bien)).toEqual({});
  });

  it('dice qué falta en cada campo, en palabras', () => {
    const e = revisar(VACIO);
    expect(Object.keys(e).sort()).toEqual(['clave', 'correo', 'empresa', 'nit', 'representante', 'telefono']);
    expect(e.representante).toBe('Nombre y apellido');
    expect(revisar({ ...bien, nit: '12345' }).nit).toBe('El NIT tiene entre 6 y 12 dígitos');
    expect(revisar({ ...bien, clave: 'corta' }).clave).toBe('Al menos 8 caracteres');
  });

  it('manda los datos limpios: NIT y teléfono solo con dígitos, correo en minúsculas', () => {
    expect(limpiar(bien)).toEqual({
      empresa: 'Distribuidora El Trébol',
      nit: '1023456029',
      ciudad: 'Santa Cruz',
      representante: 'Ana Rojas',
      telefono: '71234567',
      correo: 'ventas@eltrebol.bo',
      clave: 'Trebol.2026',
    });
  });

  it('sin sesión al Router, y el motivo de Catálogo llega tal cual', async () => {
    const fetchFalso = vi.fn().mockResolvedValue({ status: 200, json: async () => ({ data: null, errors: [{ message: 'Ya hay una cuenta con ese correo' }] }) });
    vi.stubGlobal('fetch', fetchFalso);
    await expect(registrar('http://router/', bien)).rejects.toThrow('Ya hay una cuenta con ese correo');
    const [, opciones] = fetchFalso.mock.calls[0];
    expect(opciones.headers).not.toHaveProperty('authorization');
    expect(JSON.parse(opciones.body).variables.entrada.nit).toBe('1023456029');
    vi.unstubAllGlobals();
  });
});
