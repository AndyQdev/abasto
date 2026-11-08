import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { graphql } from '../servicios';
import { Reclamos } from './Reclamos';

vi.mock('../servicios', () => ({ graphql: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Una respuesta que se resuelve cuando la prueba quiere: así se ve qué pasa si llega tarde. */
function diferida<T>() {
  let resolver!: (v: T) => void;
  const promesa = new Promise<T>((r) => (resolver = r));
  return { promesa, resolver };
}

const reclamo = (id: string, estado: string, codigo: string) => ({
  id,
  motivo: 'DANADO',
  detalle: null,
  estado,
  respuesta: estado === 'ABIERTO' ? null : 'Listo',
  devuelto: null,
  forma: null,
  creadoEn: '2026-11-06T10:00:00Z',
  resueltoEn: null,
  pedido: { id: `p-${id}`, codigo, estado: 'ENTREGADO', metodoPago: 'QR', total: { centavos: 100, texto: 'Bs 1,00' }, tienda: { id: 't', nombre: 'Tienda' }, mayorista: { id: 'm', nombre: 'Abasto' } },
});

let raiz: Root;
let contenedor: HTMLDivElement;

beforeEach(() => {
  contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.mocked(graphql).mockReset();
});

describe('Superadmin › Reclamos', () => {
  it('si la pestaña anterior responde tarde, no pisa a la que se eligió después', async () => {
    const abiertos = diferida<unknown>();
    const aprobados = diferida<unknown>();
    vi.mocked(graphql).mockImplementation(async (consulta: string, variables?: Record<string, unknown>) => {
      if (consulta.includes('tiendas')) return { tiendas: [] };
      if (consulta.includes('reclamos(estado: ABIERTO)')) return { reclamos: [] };
      return (variables?.estado === 'APROBADO' ? aprobados.promesa : abiertos.promesa) as never;
    });

    await act(async () => raiz.render(<Reclamos />));
    const pestana = [...contenedor.querySelectorAll('button[role="tab"]')].find((b) => b.textContent?.includes('Aprobados'));
    await act(async () => (pestana as HTMLButtonElement).click());

    // Llega primero lo de «Aprobados» y después, tarde, lo de «Por resolver»
    await act(async () => aprobados.resolver({ reclamos: [reclamo('b', 'APROBADO', 'A-2')] }));
    await act(async () => abiertos.resolver({ reclamos: [reclamo('a', 'ABIERTO', 'A-1')] }));

    expect(contenedor.textContent).toContain('A-2');
    expect(contenedor.textContent).not.toContain('A-1');
  });
});
