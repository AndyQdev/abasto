import { entrarConCodigo, ErrorDeAcceso, esCelular, formatoCelular, pedirCodigo, soloDigitos } from './acceso';
import { renovar, SesionVencida } from './keycloak';

function responde(estado: number, cuerpo: object): typeof fetch {
  return jest.fn(async () => new Response(JSON.stringify(cuerpo), { status: estado })) as unknown as typeof fetch;
}

describe('Entrar con el celular (sin correo ni contraseña)', () => {
  it('entiende el celular como lo escribe la gente', () => {
    expect(soloDigitos('+591 712-34-567')).toBe('71234567');
    expect(formatoCelular('71234567')).toBe('712 34 567');
    expect(esCelular('712 34 567')).toBe(true);
    expect(esCelular('41234567')).toBe(false);
  });

  it('pide el código y en modo prueba lo recibe para mostrarlo', async () => {
    const enviar = responde(200, { data: { pedirCodigo: { telefono: '59171234567', esNuevo: true, venceEnSegundos: 300, codigoDePrueba: '482913' } } });

    const envio = await pedirCodigo('712 34 567', enviar);

    expect(envio.codigoDePrueba).toBe('482913');
    const cuerpo = JSON.parse((enviar as jest.Mock).mock.calls[0][1].body);
    expect(cuerpo.variables).toEqual({ t: '71234567' });
  });

  it('con el código correcto guarda los tokens y calcula cuándo vencen', async () => {
    const enviar = responde(200, {
      data: { entrarConCodigo: { tokenDeAcceso: 'a', tokenDeRenovacion: 'r', venceEnSegundos: 900, cuentaNueva: true, nombre: 'Rosa' } },
    });

    const r = await entrarConCodigo('71234567', '482913', ' Rosa ', enviar, 1_000);

    expect(r).toEqual({ tokens: { acceso: 'a', refresco: 'r', venceEn: 901_000 }, nombre: 'Rosa', cuentaNueva: true });
    expect(JSON.parse((enviar as jest.Mock).mock.calls[0][1].body).variables).toEqual({ t: '71234567', c: '482913', n: 'Rosa' });
  });

  it('si es la primera vez, avisa que falta el nombre con su código', async () => {
    const enviar = responde(200, { errors: [{ message: '¿Cómo te llamas?', extensions: { code: 'NECESITA_NOMBRE' } }] });

    await expect(entrarConCodigo('71234567', '482913', undefined, enviar)).rejects.toMatchObject({ codigo: 'NECESITA_NOMBRE', message: '¿Cómo te llamas?' });
  });

  it('un error interno no se muestra en inglés', async () => {
    const enviar = responde(200, { errors: [{ message: 'Internal server error', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] });

    await expect(pedirCodigo('71234567', enviar)).rejects.toThrow('Algo falló de nuestro lado');
  });

  it('sin señal lo dice en español', async () => {
    const sinRed = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;

    await expect(pedirCodigo('71234567', sinRed)).rejects.toBeInstanceOf(ErrorDeAcceso);
    await expect(pedirCodigo('71234567', sinRed)).rejects.toThrow('No hay conexión');
  });
});

describe('La sesión se renueva sola', () => {
  it('renueva con el token de renovación', async () => {
    expect(await renovar('viejo', responde(200, { access_token: 'nuevo', refresh_token: 'r2', expires_in: 60 }), 0)).toEqual({
      acceso: 'nuevo',
      refresco: 'r2',
      venceEn: 60_000,
    });
  });

  it('si Keycloak ya no la reconoce, hay que volver a entrar', async () => {
    await expect(renovar('viejo', responde(400, { error: 'invalid_grant' }))).rejects.toBeInstanceOf(SesionVencida);
  });
});
