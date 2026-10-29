import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { CLIENTE_KEYCLOAK, URLS } from './config';

WebBrowser.maybeCompleteAuthSession();

/** Lo que la app sabe de quien entró, sacado del token de Keycloak. */
export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  orgId: string;
  orgNombre: string;
  roles: string[];
}

interface Tokens {
  acceso: string;
  refresco: string | null;
  venceEn: number;
}

const CLAVE = 'abasto.sesion';

/** Los tokens van al llavero del teléfono; en la vista web de desarrollo, a localStorage. */
const llavero = {
  async leer(): Promise<Tokens | null> {
    try {
      const v = Platform.OS === 'web' ? globalThis.localStorage?.getItem(CLAVE) : await SecureStore.getItemAsync(CLAVE);
      return v ? (JSON.parse(v) as Tokens) : null;
    } catch {
      return null;
    }
  },
  async escribir(t: Tokens | null) {
    const valor = t ? JSON.stringify(t) : null;
    if (Platform.OS === 'web') {
      if (valor) globalThis.localStorage?.setItem(CLAVE, valor);
      else globalThis.localStorage?.removeItem(CLAVE);
      return;
    }
    if (valor) await SecureStore.setItemAsync(CLAVE, valor);
    else await SecureStore.deleteItemAsync(CLAVE);
  },
};

/** Lee el cuerpo de un JWT (base64url) sin verificarlo: la verificación la hace cada servicio. */
export function leerToken(jwt: string): Record<string, unknown> {
  const cuerpo = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const relleno = cuerpo + '='.repeat((4 - (cuerpo.length % 4)) % 4);
  const binario = globalThis.atob(relleno);
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

export function usuarioDe(jwt: string): Usuario {
  const p = leerToken(jwt);
  const roles = ((p.realm_access as { roles?: string[] } | undefined)?.roles ?? []).filter(
    (r) => !r.startsWith('default-roles') && r !== 'offline_access' && r !== 'uma_authorization',
  );
  return {
    id: String(p.sub ?? ''),
    nombre: String(p.name ?? p.preferred_username ?? ''),
    correo: String(p.email ?? ''),
    orgId: String(p.org_id ?? ''),
    orgNombre: String(p.org_nombre ?? p.name ?? ''),
    roles,
  };
}

interface Sesion {
  usuario: Usuario | null;
  /** Mientras se lee el llavero al abrir la app */
  cargando: boolean;
  entrar: () => Promise<void>;
  salir: () => Promise<void>;
  /** Token vigente (lo renueva si está por vencer). Null si no hay sesión. */
  token: () => Promise<string | null>;
  error: string | null;
}

const Contexto = createContext<Sesion | null>(null);

/** El token que usan los servicios fuera de React (bandeja, GraphQL). Lo fija el proveedor. */
let tokenGlobal: () => Promise<string | null> = async () => null;
export const tokenActual = () => tokenGlobal();

export function ProveedorDeSesion({ children }: { children: ReactNode }) {
  const descubrimiento = AuthSession.useAutoDiscovery(URLS.keycloak);
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'abasto' });
  const [peticion, respuesta, pedir] = AuthSession.useAuthRequest(
    { clientId: CLIENTE_KEYCLOAK, redirectUri, scopes: ['openid', 'profile', 'email', 'offline_access'], usePKCE: true },
    descubrimiento,
  );
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tokensRef = useRef<Tokens | null>(null);

  const guardar = useCallback(async (t: Tokens | null) => {
    tokensRef.current = t;
    setTokens(t);
    await llavero.escribir(t);
  }, []);

  useEffect(() => {
    void llavero.leer().then((t) => {
      tokensRef.current = t;
      setTokens(t);
      setCargando(false);
    });
  }, []);

  // Vuelve de Keycloak con el código: se canjea por los tokens (PKCE)
  useEffect(() => {
    if (respuesta?.type !== 'success' || !descubrimiento || !peticion?.codeVerifier) return;
    AuthSession.exchangeCodeAsync(
      { clientId: CLIENTE_KEYCLOAK, code: respuesta.params.code, redirectUri, extraParams: { code_verifier: peticion.codeVerifier } },
      descubrimiento,
    )
      .then((r) => guardar({ acceso: r.accessToken, refresco: r.refreshToken ?? null, venceEn: Date.now() + (r.expiresIn ?? 300) * 1000 }))
      .catch(() => setError('No se pudo iniciar sesión. Vuelve a intentar.'));
  }, [respuesta, descubrimiento, peticion, redirectUri, guardar]);

  const token = useCallback(async () => {
    const t = tokensRef.current;
    if (!t) return null;
    if (Date.now() < t.venceEn - 30_000) return t.acceso;
    // Por vencer: se renueva con el refresh token. Sin señal se usa el que hay y el servicio dirá si venció.
    if (!t.refresco || !descubrimiento) return t.acceso;
    try {
      const r = await AuthSession.refreshAsync({ clientId: CLIENTE_KEYCLOAK, refreshToken: t.refresco }, descubrimiento);
      const nuevo = { acceso: r.accessToken, refresco: r.refreshToken ?? t.refresco, venceEn: Date.now() + (r.expiresIn ?? 300) * 1000 };
      await guardar(nuevo);
      return nuevo.acceso;
    } catch {
      return t.acceso;
    }
  }, [descubrimiento, guardar]);

  useEffect(() => {
    tokenGlobal = token;
  }, [token]);

  const valor = useMemo<Sesion>(
    () => ({
      usuario: tokens ? usuarioDe(tokens.acceso) : null,
      cargando,
      error,
      token,
      entrar: async () => {
        setError(null);
        if (!peticion) return setError('Todavía no hay conexión con el servidor. Revisa tu señal.');
        await pedir();
      },
      salir: () => guardar(null),
    }),
    [tokens, cargando, error, token, peticion, pedir, guardar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): Sesion {
  const s = useContext(Contexto);
  if (!s) throw new Error('useSesion fuera de ProveedorDeSesion');
  return s;
}
