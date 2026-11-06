import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { GraphQL } from '../graphql';
import { compradores, conAprobadas, VistaClientes } from './clientes';

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
  aprobadas: { tienda: { id: string; nombre: string; ciudad: string } }[] = [];
  fallaDeCobros: Error | null = null;
  creditos: unknown[] = [];
  falla: Error | null = null;

  async consultar<T>(consulta: string, variables: Record<string, unknown> = {}): Promise<T> {
    this.consultas.push({ consulta, variables });
    if (this.falla) throw this.falla;
    if (consulta.includes('misCreditosDados')) {
      if (this.fallaDeCobros) throw this.fallaDeCobros;
      return { misCreditosDados: this.creditos } as T;
    }
    if (consulta.includes('asignarCredito')) {
      if (this.fallaDeCobros) throw this.fallaDeCobros;
      const entrada = variables['entrada'] as { tiendaId: string; limiteCentavos: number; plazoDias: number };
      const texto = `Bs ${entrada.limiteCentavos / 100}`;
      const linea = {
        tienda: { id: entrada.tiendaId },
        limite: { centavos: entrada.limiteCentavos, texto },
        usado: { centavos: 0, texto: 'Bs 0' },
        disponible: { centavos: entrada.limiteCentavos, texto },
        plazoDias: entrada.plazoDias,
      };
      this.creditos = [linea];
      return { asignarCredito: linea } as T;
    }
    if (consulta.includes('aprobarCliente') || consulta.includes('rechazarCliente')) {
      this.solicitudes = [];
      return {} as T;
    }
    return { misSolicitudes: this.solicitudes, misClientes: this.aprobadas } as T;
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

describe('Clientes: el crédito (CU-04)', () => {
  const escribir = (campo: HTMLInputElement | null, valor: string) => {
    if (!campo) throw new Error('No encontré el campo');
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  };

  it('al aprobar con crédito también lo asigna, con el plazo elegido', async () => {
    const graphql = new GraphQLFalso();
    const fixture = await montar(graphql);
    escribir(raiz(fixture).querySelector<HTMLInputElement>('input[aria-label="Crédito para Tienda Doña Rosa"]'), '2.000');
    const plazo = raiz(fixture).querySelector<HTMLSelectElement>('select[aria-label="Plazo para Tienda Doña Rosa"]');
    if (!plazo) throw new Error('No encontré el plazo');
    plazo.value = '30';
    plazo.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    (raiz(fixture).querySelector('.boton-primario') as HTMLButtonElement).click();
    await estabilizar(fixture);

    const credito = graphql.consultas.find((c) => c.consulta.includes('asignarCredito'));
    expect(credito?.variables).toEqual({ entrada: { tiendaId: 't1', limiteCentavos: 200_000, plazoDias: 30 } });
  });

  it('aprobar sin crédito no llama a Cobros', async () => {
    const graphql = new GraphQLFalso();
    const fixture = await montar(graphql);
    (raiz(fixture).querySelector('.boton-primario') as HTMLButtonElement).click();
    await estabilizar(fixture);
    expect(graphql.consultas.some((c) => c.consulta.includes('asignarCredito'))).toBe(false);
  });

  it('un crédito que no se entiende frena la aprobación', async () => {
    const graphql = new GraphQLFalso();
    const fixture = await montar(graphql);
    escribir(raiz(fixture).querySelector<HTMLInputElement>('input[aria-label="Crédito para Tienda Doña Rosa"]'), 'mucho');
    (raiz(fixture).querySelector('.boton-primario') as HTMLButtonElement).click();
    await estabilizar(fixture);
    expect(graphql.consultas.some((c) => c.consulta.includes('aprobarCliente'))).toBe(false);
    expect(raiz(fixture).querySelector('.falla')?.textContent).toContain('no se entiende');
  });

  it('si Cobros falla al aprobar, avisa que la tienda quedó aprobada sin crédito', async () => {
    const graphql = new GraphQLFalso();
    graphql.fallaDeCobros = new Error('Cobros no responde');
    const fixture = await montar(graphql);
    escribir(raiz(fixture).querySelector<HTMLInputElement>('input[aria-label="Crédito para Tienda Doña Rosa"]'), '100');
    (raiz(fixture).querySelector('.boton-primario') as HTMLButtonElement).click();
    await estabilizar(fixture);
    expect(raiz(fixture).querySelector('.falla')?.textContent).toContain('el crédito no se guardó');
  });

  it('a un cliente aprobado se le da crédito desde su tarjeta y el saldo se ve al momento', async () => {
    const graphql = new GraphQLFalso();
    graphql.solicitudes = [];
    graphql.aprobadas = [{ tienda: { id: 't2', nombre: 'Tienda Nueva', ciudad: 'La Paz' } }];
    const fixture = await montar(graphql);
    expect(raiz(fixture).textContent).toContain('Sin crédito');

    const botones = [...raiz(fixture).querySelectorAll('button')];
    botones.find((b) => b.textContent?.includes('Dar crédito'))?.click();
    fixture.detectChanges();
    escribir(raiz(fixture).querySelector<HTMLInputElement>('input[aria-label="Límite de crédito de Tienda Nueva"]'), '500');
    raiz(fixture).querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await estabilizar(fixture);

    expect(graphql.consultas.find((c) => c.consulta.includes('asignarCredito'))?.variables).toEqual({
      entrada: { tiendaId: 't2', limiteCentavos: 50_000, plazoDias: 15 },
    });
    expect(raiz(fixture).textContent).toContain('Le das Bs 500 a 15 días');
  });

  it('si Cobros no responde, los clientes se ven igual', async () => {
    const graphql = new GraphQLFalso();
    graphql.fallaDeCobros = new Error('Cobros no responde');
    graphql.solicitudes = [];
    graphql.aprobadas = [{ tienda: { id: 't2', nombre: 'Tienda Nueva', ciudad: 'La Paz' } }];
    const fixture = await montar(graphql);
    expect(raiz(fixture).textContent).toContain('Tienda Nueva');
    expect(raiz(fixture).querySelector('.falla')).toBeNull();
  });

  it('las aprobadas que todavía no compraron se suman sin repetir a las que sí', () => {
    const c = { id: 'a', nombre: 'A', zona: 'Z', pedidos: 3, totalCentavos: 100, ultimo: '2026-01-01' };
    const lista = conAprobadas([c], [
      { tienda: { id: 'a', nombre: 'A', ciudad: 'X' } },
      { tienda: { id: 'b', nombre: 'B', ciudad: 'La Paz' } },
    ]);
    expect(lista.map((x) => x.id)).toEqual(['a', 'b']);
    expect(lista[1]).toMatchObject({ zona: 'La Paz', pedidos: 0, ultimo: '' });
  });
});

describe('Clientes: quién te compra', () => {
  it('suma los pedidos por tienda (sin rechazados) y ordena del que más compra', () => {
    const venta = (tienda: string, centavos: number, creadoEn: string, estado = 'ENTREGADO', zona = 'Plan 3000') => ({
      estado, creadoEn, total: { centavos }, tienda: { id: tienda, nombre: tienda }, entrega: { zona },
    });
    const lista = compradores([
      venta('Doña Rosa', 1000, '2026-11-01T10:00:00Z'),
      venta('Don Pedro', 5000, '2026-11-02T10:00:00Z', 'CONFIRMADO', 'Equipetrol'),
      venta('Doña Rosa', 2000, '2026-11-02T09:00:00Z', 'ENTREGADO', 'Villa 1ro de Mayo'),
      venta('Doña Rosa', 9000, '2026-11-02T11:00:00Z', 'RECHAZADO'),
    ]);
    expect(lista.map((c) => [c.nombre, c.pedidos, c.totalCentavos, c.zona])).toEqual([
      ['Don Pedro', 1, 5000, 'Equipetrol'],
      ['Doña Rosa', 2, 3000, 'Villa 1ro de Mayo'],
    ]);
  });
});
