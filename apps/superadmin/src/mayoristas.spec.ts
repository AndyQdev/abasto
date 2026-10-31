import { describe, expect, it } from 'vitest';
import { cuando, insignia, motivoValido, whatsapp } from './mayoristas';

describe('mayoristas por verificar (CU-01)', () => {
  it('cada estado con su palabra', () => {
    expect(insignia('PENDIENTE')).toEqual({ texto: 'Por verificar', clase: 'advertencia' });
    expect(insignia('VERIFICADO').texto).toBe('Verificado');
    expect(insignia('RECHAZADO').clase).toBe('error');
  });

  it('cuándo se registró: horas si fue hoy, fecha dd/mm/aaaa si no', () => {
    const ahora = new Date('2026-10-31T15:00:00');
    expect(cuando(null, ahora)).toBe('De la semilla');
    expect(cuando('2026-10-31T14:30:00', ahora)).toBe('Hace un momento');
    expect(cuando('2026-10-31T12:00:00', ahora)).toBe('Hace 3 h');
    expect(cuando('2026-10-28T09:00:00', ahora)).toBe('28/10/2026');
  });

  it('el motivo del rechazo tiene que decir algo', () => {
    expect(motivoValido('  no ')).toBeNull();
    expect(motivoValido('  El NIT   no corresponde ')).toBe('El NIT no corresponde');
  });

  it('WhatsApp con el código de Bolivia si el número es local', () => {
    expect(whatsapp('7123-4567')).toBe('https://wa.me/59171234567');
    expect(whatsapp('+591 71234567')).toBe('https://wa.me/59171234567');
    expect(whatsapp(null)).toBeNull();
  });
});
