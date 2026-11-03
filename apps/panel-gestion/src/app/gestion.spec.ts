import { TestBed } from '@angular/core/testing';
import { cantidadConUnidad } from './estilos';
import { GestionRaiz } from './gestion';
import { GraphQL } from './graphql';

describe('Gestión', () => {
  it('la cantidad siempre va con su unidad', () => {
    expect(cantidadConUnidad(2, 'CAJA', 96)).toBe('2 cajas · 96 u.');
    expect(cantidadConUnidad(1, 'DOCENA', 12)).toBe('1 docena · 12 u.');
  });

  it('pasa la sesión del Shell al cliente GraphQL', () => {
    const fixture = TestBed.createComponent(GestionRaiz);
    const sesion = {
      token: async () => 't',
      usuario: { id: 'u', nombre: 'Los Pozos', orgId: 'lp', orgNombre: 'Distribuidora Los Pozos', roles: ['mayorista'] },
      urls: { router: 'http://localhost:4000/', asistente: '', conecta: '' },
    };
    fixture.componentInstance.sesion = sesion;
    expect(TestBed.inject(GraphQL).sesion()).toBe(sesion);
  });

  it('un módulo que falta muestra en qué fase se construye', async () => {
    const fixture = TestBed.createComponent(GestionRaiz);
    fixture.componentInstance.ruta = 'conecta';
    fixture.detectChanges();
    await fixture.whenStable();
    const raiz = fixture.nativeElement.shadowRoot as ShadowRoot;
    const vista = raiz.querySelector('abasto-vista-en-construccion')?.shadowRoot;
    expect(vista?.textContent).toContain('fase F3');
    // Cuentas por cobrar (CU-09) ya tiene su pantalla
    fixture.componentRef.setInput('ruta', 'cuentas');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(raiz.querySelector('abasto-vista-cuentas')).not.toBeNull();
  });
});
