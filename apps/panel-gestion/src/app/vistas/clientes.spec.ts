import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { GraphQL } from '../graphql';
import { VistaClientes } from './clientes';

interface SolicitudDePrueba {
  tienda: { id: string; nombre: string; ciudad: string };
  estado: string;
}

const SOLICITUD: SolicitudDePrueba = {
  tienda: { id: 't1', nombre: 'Tienda Doña Rosa', ciudad: 'Santa Cruz' },
  estado: 'SOLICITADA',
};

class GraphQLFalso {
  readonly consultas: { consulta: string; variables: Record<string, unknown> }[] = [];
  solicitudes: SolicitudDePrueba[] = [SOLICITUD];
  falla: Error | null = null;

  async consultar<T>(consulta: string, variables: Record<string, unknown> = {}): Promise<T> {
    this.consultas.push({ consulta, variables });
    if (this.falla) throw this.falla;
    if (consulta.includes('aprobarCliente') || consulta.includes('rechazarCliente')) {
      this.solicitudes = [];
      return {} as T;
    }
    return { misSolicitudes: this.solicitudes } as T;
  }
}

async function montar(graphql: GraphQLFalso) {
  TestBed.configureTestingModule({ providers: [{ provide: GraphQL, useValue: graphql }] });
  const fixture = TestBed.createComponent(VistaClientes);
  fixture.detectChanges();
  await estabilizar(fixture);
  return fixture;
}

async function estabilizar(fixture: ComponentFixture<VistaClientes>) {
  await new Promise((resolver) => setTimeout(resolver, 0));
  fixture.detectChanges();
  await fixture.whenStable();
}

function raiz(fixture: ComponentFixture<VistaClientes>) {
  return fixture.nativeElement.shadowRoot as ShadowRoot;
}

describe('Vista de Clientes', () => {
  it('lista las tiendas que pidieron ser clientes con su estado', async () => {
    const fixture = await montar(new GraphQLFalso());

    expect(raiz(fixture).textContent).toContain('Tienda Doña Rosa');
    expect(raiz(fixture).textContent).toContain('Santa Cruz');
    expect(raiz(fixture).textContent).toContain('Pendiente');
  });

  it('aprobar con VIP llama la mutación con la lista VIP', async () => {
    const graphql = new GraphQLFalso();
    const fixture = await montar(graphql);

    const selector = raiz(fixture).querySelector('select') as HTMLSelectElement;
    selector.value = 'VIP';
    selector.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    (raiz(fixture).querySelector('.boton-primario') as HTMLButtonElement).click();
    await estabilizar(fixture);

    const aprobacion = graphql.consultas.find((c) => c.consulta.includes('aprobarCliente'));
    expect(aprobacion?.variables).toEqual({ tiendaId: 't1', lista: 'VIP' });
    expect(raiz(fixture).textContent).toContain('No tienes solicitudes pendientes.');
  });

  it('rechazar llama rechazarCliente y la solicitud sale de pendientes', async () => {
    const graphql = new GraphQLFalso();
    const fixture = await montar(graphql);

    (raiz(fixture).querySelector('.boton-secundario') as HTMLButtonElement).click();
    await estabilizar(fixture);

    const rechazo = graphql.consultas.find((c) => c.consulta.includes('rechazarCliente'));
    expect(rechazo?.variables).toEqual({ tiendaId: 't1' });
    expect(raiz(fixture).textContent).toContain('No tienes solicitudes pendientes.');
  });

  it('sin solicitudes muestra un estado vacío amable', async () => {
    const graphql = new GraphQLFalso();
    graphql.solicitudes = [];
    const fixture = await montar(graphql);

    expect(raiz(fixture).textContent).toContain('No tienes solicitudes pendientes.');
  });

  it('si GraphQL falla muestra el mensaje en pantalla', async () => {
    const graphql = new GraphQLFalso();
    graphql.falla = new Error('No tienes permiso para ver estas solicitudes');
    const fixture = await montar(graphql);

    expect(raiz(fixture).querySelector('.falla')?.textContent).toContain('No tienes permiso');
  });
});
