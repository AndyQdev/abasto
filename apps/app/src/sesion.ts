import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

/**
 * Con el teléfono conectado por USB, `adb reverse tcp:8180 tcp:8180` y `adb reverse tcp:8084 tcp:8084`
 * hacen que localhost del teléfono sea la computadora: el emisor del token queda igual que en el navegador.
 */
export const URLS = {
  keycloak: process.env.EXPO_PUBLIC_KEYCLOAK_URL ?? 'http://localhost:8180/realms/abasto',
  conecta: process.env.EXPO_PUBLIC_CONECTA_URL ?? 'http://localhost:8084',
};

export const redireccion = AuthSession.makeRedirectUri({ scheme: 'abasto-campo' });

/** Misma cuenta que el Panel: el mayorista entra con su usuario de siempre (sesión única con Keycloak). */
export function useLogin() {
  const descubrimiento = AuthSession.useAutoDiscovery(URLS.keycloak);
  const [peticion, respuesta, pedir] = AuthSession.useAuthRequest(
    { clientId: 'abasto-campo', redirectUri: redireccion, scopes: ['openid', 'profile'], usePKCE: true },
    descubrimiento,
  );
  return { descubrimiento, peticion, respuesta, pedir };
}

export async function canjearCodigo(
  codigo: string,
  verificador: string,
  descubrimiento: AuthSession.DiscoveryDocument,
): Promise<string> {
  const r = await AuthSession.exchangeCodeAsync(
    { clientId: 'abasto-campo', code: codigo, redirectUri: redireccion, extraParams: { code_verifier: verificador } },
    descubrimiento,
  );
  return r.accessToken;
}
