import { entrarConClave, ErrorDeSesion, renovar } from './keycloak';

function respuesta(estado: number, cuerpo: object): typeof fetch {
  return jest.fn(async () => new Response(JSON.stringify(cuerpo), { status: estado })) as unknown as typeof fetch;
}

describe('Inicio de sesión nativo', () => {
  it('entra con correo y contraseña y calcula cuándo vence el token', async () => {
    const enviar = respuesta(200, { access_token: 'acceso', refresh_token: 'refresco', expires_in: 900 });

    const t = await entrarConClave('  DonaRosa@Abasto.bo ', 'abasto123', enviar, 1_000);

    expect(t).toEqual({ acceso: 'acceso', refresco: 'refresco', venceEn: 901_000 });
    const [url, opciones] = (enviar as jest.Mock).mock.calls[0];
    expect(url).toContain('/protocol/openid-connect/token');
    const cuerpo = new URLSearchParams(opciones.body);
    expect(cuerpo.get('grant_type')).toBe('password');
    expect(cuerpo.get('username')).toBe('donarosa@abasto.bo');
    expect(cuerpo.get('client_id')).toBe('abasto-app');
  });

  it('con la contraseña mala avisa en español', async () => {
    await expect(entrarConClave('donarosa@abasto.bo', 'mala', respuesta(401, { error: 'invalid_grant', error_description: 'Invalid user credentials' })))
      .rejects.toThrow('El correo o la contraseña no son correctos.');
  });

  it('sin señal lo dice, en vez de un error técnico', async () => {
    const sinRed = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    await expect(entrarConClave('donarosa@abasto.bo', 'abasto123', sinRed)).rejects.toThrow(ErrorDeSesion);
    await expect(entrarConClave('donarosa@abasto.bo', 'abasto123', sinRed)).rejects.toThrow('No hay conexión con Abasto');
  });

  it('no llama a Keycloak si falta el correo o la contraseña', async () => {
    const enviar = respuesta(200, {});
    await expect(entrarConClave('', 'x', enviar)).rejects.toThrow('Escribe tu correo y tu contraseña.');
    expect(enviar).not.toHaveBeenCalled();
  });

  it('renueva con el refresh token (si Keycloak no manda otro, la sesión conserva el anterior)', async () => {
    const t = await renovar('viejo', respuesta(200, { access_token: 'nuevo', expires_in: 60 }), 0);
    expect(t).toEqual({ acceso: 'nuevo', refresco: null, venceEn: 60_000 });
  });
});
