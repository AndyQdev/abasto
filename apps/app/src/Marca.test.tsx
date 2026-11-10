import { RECORTE, SIMBOLO, TINTAS, iconoSvg, simboloSvg } from '@abasto/marca';
import { render, screen } from '@testing-library/react-native';
import { Logo } from './Marca';

describe('La marca', () => {
  it('el logo se anuncia como «Abasto» y dice la palabra en minúsculas', async () => {
    await render(<Logo />);
    expect(screen.getByLabelText('Abasto')).toBeTruthy();
    expect(screen.getByText('abasto')).toBeTruthy();
  });

  it('el paquete queda dentro del hueco que se recorta de las patas', () => {
    const { hueco, paquete } = SIMBOLO;
    expect(paquete.x).toBeGreaterThan(hueco.x);
    expect(paquete.y).toBeGreaterThan(hueco.y);
    expect(paquete.x + paquete.ancho).toBeLessThan(hueco.x + hueco.ancho);
    expect(paquete.y + paquete.alto).toBeLessThan(hueco.y + hueco.alto);
    expect(RECORTE).toContain('M-20 -20H120V120H-20Z');
  });

  it('en una sola tinta (notificaciones) no lleva cinta ni colores', () => {
    const blanco = simboloSvg({ tinta: TINTAS.blanco });
    expect(blanco).not.toContain('#C9F45A');
    expect(blanco).not.toContain('#FFB454');
    expect(blanco.match(/<rect /g)).toHaveLength(1); // solo el paquete
  });

  it('el ícono va sobre el cuadrado redondeado verde bosque, con margen', () => {
    const icono = iconoSvg({ id: 'x' });
    expect(icono).toContain('fill="#182D25"');
    expect(icono).toContain('scale(0.72)');
    expect(icono).toContain('clip-path="url(#x)"');
  });
});
