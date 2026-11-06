import { describe, expect, it } from 'vitest';
import { centavosDe, faltaParaResolver, insigniaDeReclamo, textoDeDevolucion, textoDeMotivo, type Decision } from './reclamos';

const decision = (parcial: Partial<Decision>): Decision => ({ monto: '', forma: '', respuesta: 'Te devolvimos el dinero', ...parcial });

describe('Reclamos', () => {
  it('entiende el monto como se escribe en Bolivia; vacío es no devolver dinero', () => {
    expect(centavosDe('1.200,50')).toBe(120_050);
    expect(centavosDe('Bs 50')).toBe(5_000);
    expect(centavosDe('1.200')).toBe(120_000);
    expect(centavosDe('')).toBe(0);
    expect(centavosDe('mucho')).toBeNull();
    expect(centavosDe('-5')).toBeNull();
  });

  it('para aprobar pide la respuesta; con dinero, también cómo se devolvió', () => {
    expect(faltaParaResolver(true, decision({ respuesta: ' ' }), 10_000)).toContain('Escribe');
    expect(faltaParaResolver(true, decision({}), 10_000)).toBeNull();
    expect(faltaParaResolver(true, decision({ monto: '50' }), 10_000)).toContain('Elige cómo');
    expect(faltaParaResolver(true, decision({ monto: '50', forma: 'QR' }), 10_000)).toBeNull();
  });

  it('no deja anotar más que el total ni un monto que no se entiende', () => {
    expect(faltaParaResolver(true, decision({ monto: '100,01', forma: 'QR' }), 10_000)).toContain('más que el total');
    expect(faltaParaResolver(true, decision({ monto: '100,00', forma: 'QR' }), 10_000)).toBeNull();
    expect(faltaParaResolver(true, decision({ monto: 'x', forma: 'QR' }), 10_000)).toContain('no se entiende');
  });

  it('para rechazar solo pide la respuesta, aunque haya un monto escrito', () => {
    expect(faltaParaResolver(false, decision({ monto: 'x' }), 10_000)).toBeNull();
    expect(faltaParaResolver(false, decision({ respuesta: '' }), 10_000)).toContain('Escribe');
  });

  it('dice lo que se devolvió en palabras', () => {
    expect(textoDeDevolucion({ devuelto: { centavos: 5000, texto: 'Bs 50,00' }, forma: 'TRANSFERENCIA' })).toBe('Devolviste Bs 50,00 por transferencia');
    expect(textoDeDevolucion({ devuelto: { centavos: 5000, texto: 'Bs 50,00' }, forma: 'OTRA' })).toBe('Devolviste Bs 50,00');
    expect(textoDeDevolucion({ devuelto: { centavos: 0, texto: 'Bs 0,00' }, forma: null })).toBe('Sin devolver dinero');
    expect(textoDeDevolucion({ devuelto: null, forma: null })).toBe('Sin devolver dinero');
  });

  it('nombra motivos y estados', () => {
    expect(textoDeMotivo('NO_LLEGO')).toBe('No llegó');
    expect(textoDeMotivo('NUEVO')).toBe('NUEVO');
    expect(insigniaDeReclamo('ABIERTO').texto).toBe('Por resolver');
  });
});
