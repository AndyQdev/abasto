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

  it('cada módulo del menú tiene su pantalla: ya no queda ninguno en construcción', async () => {
    const fixture = TestBed.createComponent(GestionRaiz);
    const raiz = fixture.nativeElement.shadowRoot as ShadowRoot;
    for (const [ruta, vista] of [
      ['pedidos', 'abasto-vista-pedidos'],
      ['compras', 'abasto-vista-compras'],
      ['productos', 'abasto-vista-productos'],
      ['clientes', 'abasto-vista-clientes'],
      ['cuentas', 'abasto-vista-cuentas'],
      ['conecta', 'abasto-vista-conecta'],
    ]) {
      fixture.componentRef.setInput('ruta', ruta);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(raiz.querySelector(vista), ruta).not.toBeNull();
      expect(raiz.querySelector('abasto-vista-en-construccion')).toBeNull();
    }
  });
});
